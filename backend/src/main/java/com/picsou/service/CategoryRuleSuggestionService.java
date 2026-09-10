package com.picsou.service;

import com.picsou.dto.CategoryRuleSuggestionResponse;
import com.picsou.model.CategoryRule;
import com.picsou.model.DismissedRuleSuggestion;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.FamilyMember;
import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.CategoryRuleRepository;
import com.picsou.repository.DismissedRuleSuggestionRepository;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Proposes high-confidence auto-categorization rules by mining the member's own history: a
 * word that shows up in transaction descriptions which are, over and over, filed under one
 * single category is a rule waiting to happen. Only patterns with at least
 * {@link #MIN_CATEGORIZED} supporting transactions AND a {@link #MIN_DOMINANT_SHARE}+ single
 * -category share are suggested; anything already covered by an existing rule, or explicitly
 * dismissed, is filtered out.
 */
@Service
@Transactional(readOnly = true)
public class CategoryRuleSuggestionService {

    private static final int LOOKBACK_MONTHS = 12;
    private static final int MIN_TOKEN_LENGTH = 4;
    private static final int MIN_CATEGORIZED = 3;
    private static final double MIN_DOMINANT_SHARE = 0.8;
    private static final double MAX_OVERLAP = 0.6;
    private static final int MAX_SUGGESTIONS = 10;

    /** Bank-statement filler that would otherwise cluster half the transactions together. */
    private static final Set<String> STOPWORDS = Set.of(
        "prelevement", "prelvt", "prelt", "virement", "paiement", "paiment", "carte",
        "achat", "sepa", "vers", "pour", "avec", "date", "compte", "facture", "mensuel",
        "abonnement", "cotisation", "reglement", "france", "paris", "europe"
    );

    private final TransactionRepository transactionRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final CategoryRuleRepository categoryRuleRepository;
    private final DismissedRuleSuggestionRepository dismissedRuleSuggestionRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final Clock clock;

    public CategoryRuleSuggestionService(
        TransactionRepository transactionRepository,
        ExpenseCategoryRepository expenseCategoryRepository,
        CategoryRuleRepository categoryRuleRepository,
        DismissedRuleSuggestionRepository dismissedRuleSuggestionRepository,
        FamilyMemberRepository familyMemberRepository,
        Clock clock
    ) {
        this.transactionRepository = transactionRepository;
        this.expenseCategoryRepository = expenseCategoryRepository;
        this.categoryRuleRepository = categoryRuleRepository;
        this.dismissedRuleSuggestionRepository = dismissedRuleSuggestionRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.clock = clock;
    }

    public List<CategoryRuleSuggestionResponse> getSuggestions(Long memberId) {
        LocalDate today = LocalDate.now(clock);
        List<Transaction> window = transactionRepository.findByAccount_Member_IdAndDateBetween(
                memberId, today.minusMonths(LOOKBACK_MONTHS), today).stream()
            .filter(this::isRealExpense)
            .toList();
        if (window.isEmpty()) return List.of();

        List<String> existingPatterns = categoryRuleRepository.findAllByMemberIdOrderByIdAsc(memberId).stream()
            .map(CategoryRule::getPattern).map(p -> p.toLowerCase(Locale.ROOT)).toList();
        Set<String> dismissed = dismissedRuleSuggestionRepository.findAllByMemberId(memberId).stream()
            .map(d -> d.getPattern().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        Map<Long, ExpenseCategory> categoriesById = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId).stream()
            .collect(Collectors.toMap(ExpenseCategory::getId, c -> c));

        // token -> transactions whose normalized description contains it
        Map<String, List<Transaction>> byToken = new LinkedHashMap<>();
        for (Transaction t : window) {
            for (String token : tokens(t.getDescription())) {
                byToken.computeIfAbsent(token, k -> new ArrayList<>()).add(t);
            }
        }

        List<Candidate> candidates = new ArrayList<>();
        for (var entry : byToken.entrySet()) {
            String token = entry.getKey();
            if (isCovered(token, existingPatterns) || dismissed.contains(token)) continue;

            List<Transaction> matches = entry.getValue();
            Map<Long, Long> byCategory = matches.stream()
                .filter(t -> t.getExpenseCategoryId() != null)
                .collect(Collectors.groupingBy(Transaction::getExpenseCategoryId, Collectors.counting()));
            long categorized = byCategory.values().stream().mapToLong(Long::longValue).sum();
            if (categorized < MIN_CATEGORIZED) continue;

            var dominant = byCategory.entrySet().stream().max(Map.Entry.comparingByValue()).orElseThrow();
            double share = dominant.getValue() / (double) categorized;
            if (share < MIN_DOMINANT_SHARE) continue;

            ExpenseCategory category = categoriesById.get(dominant.getKey());
            if (category == null) continue; // category deleted since -- nothing to suggest

            long uncategorized = matches.stream().filter(t -> t.getExpenseCategoryId() == null).count();
            candidates.add(new Candidate(
                token,
                category,
                dominant.getValue().intValue(),
                (int) uncategorized,
                (int) Math.round(share * 100),
                matches.stream().map(Transaction::getId).collect(Collectors.toSet())
            ));
        }

        // Most impactful first, then drop near-duplicates that mostly cover the same rows
        // (e.g. "carrefour" and "market" of "CARREFOUR MARKET").
        candidates.sort(Comparator.comparingInt((Candidate c) -> c.matchingCategorized + c.matchingUncategorized).reversed());
        List<Candidate> kept = new ArrayList<>();
        for (Candidate c : candidates) {
            if (kept.stream().noneMatch(k -> overlap(k.txIds, c.txIds) > MAX_OVERLAP)) {
                kept.add(c);
            }
            if (kept.size() == MAX_SUGGESTIONS) break;
        }

        return kept.stream()
            .map(c -> new CategoryRuleSuggestionResponse(
                c.pattern, c.category.getId(), c.category.getName(), c.category.getColor(),
                c.matchingCategorized, c.matchingUncategorized, c.dominantSharePercent))
            .toList();
    }

    @Transactional
    public void dismiss(Long memberId, String pattern) {
        String normalized = pattern.toLowerCase(Locale.ROOT).trim();
        if (normalized.isEmpty() || dismissedRuleSuggestionRepository.existsByMemberIdAndPattern(memberId, normalized)) return;
        FamilyMember member = familyMemberRepository.getReferenceById(memberId);
        dismissedRuleSuggestionRepository.save(DismissedRuleSuggestion.builder().member(member).pattern(normalized).build());
    }

    private boolean isRealExpense(Transaction t) {
        if (t.getAmount().signum() >= 0) return false;
        if (t.getProStatus() == ProStatus.VIREMENT_INTERNE) return false;
        return !(t.getProStatus() == ProStatus.PRO_A_REMBOURSER && t.getReimbursementStatus() == ReimbursementStatus.REMBOURSE);
    }

    /** A candidate is covered if an existing rule's pattern is a substring of it, or it of the
     * pattern -- so "carrefour" isn't suggested when a rule "carref" already exists. */
    private boolean isCovered(String token, List<String> existingPatterns) {
        return existingPatterns.stream().anyMatch(p -> token.contains(p) || p.contains(token));
    }

    private double overlap(Set<Long> a, Set<Long> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        Set<Long> smaller = a.size() <= b.size() ? a : b;
        Set<Long> larger = smaller == a ? b : a;
        long shared = smaller.stream().filter(larger::contains).count();
        return shared / (double) smaller.size();
    }

    /** Digit- and punctuation-stripped words of length >= {@link #MIN_TOKEN_LENGTH}, minus
     * bank-statement filler. */
    private Set<String> tokens(String description) {
        if (description == null) return Set.of();
        String normalized = description.toLowerCase(Locale.ROOT)
            .replaceAll("[0-9]", " ")
            .replaceAll("[^a-z\\u00e0-\\u00ff ]", " ");
        Set<String> tokens = new HashSet<>();
        for (String word : normalized.split("\\s+")) {
            if (word.length() >= MIN_TOKEN_LENGTH && !STOPWORDS.contains(word)) tokens.add(word);
        }
        return tokens;
    }

    private record Candidate(
        String pattern, ExpenseCategory category, int matchingCategorized, int matchingUncategorized,
        int dominantSharePercent, Set<Long> txIds
    ) {}
}
