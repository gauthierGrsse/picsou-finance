package com.picsou.service;

import com.picsou.dto.CategoryRuleRequest;
import com.picsou.dto.CategoryRuleResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.CategoryRule;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.CategoryRuleRepository;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * "If the description contains X, classify it as category Y" (and optionally set a
 * pro_status). Two application points, both idempotent and both restricted to transactions
 * with no category yet -- a rule fills in blanks, it never overrides a manual choice:
 * <ul>
 *   <li>{@link #applyToUncategorized} runs on every rule create/update (this rule's own
 *   backlog) and on every bank sync (every rule, against whatever's still uncategorized --
 *   simpler and more robust than tracking exactly which transactions are "new this batch",
 *   and it also catches up transactions a rule added later would have matched).</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class CategoryRuleService {

    private final CategoryRuleRepository categoryRuleRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final TransactionRepository transactionRepository;
    private final FamilyMemberRepository familyMemberRepository;

    public CategoryRuleService(
        CategoryRuleRepository categoryRuleRepository,
        ExpenseCategoryRepository expenseCategoryRepository,
        TransactionRepository transactionRepository,
        FamilyMemberRepository familyMemberRepository
    ) {
        this.categoryRuleRepository = categoryRuleRepository;
        this.expenseCategoryRepository = expenseCategoryRepository;
        this.transactionRepository = transactionRepository;
        this.familyMemberRepository = familyMemberRepository;
    }

    public List<CategoryRuleResponse> findAll(Long memberId) {
        Map<Long, ExpenseCategory> categoriesById = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId).stream()
            .collect(Collectors.toMap(ExpenseCategory::getId, c -> c));
        return categoryRuleRepository.findAllByMemberIdOrderByIdAsc(memberId).stream()
            .map(rule -> toResponse(rule, categoriesById))
            .toList();
    }

    @Transactional
    public CategoryRuleResponse create(CategoryRuleRequest req, Long memberId) {
        ExpenseCategory category = getCategoryOrThrow(req.expenseCategoryId(), memberId);
        CategoryRule rule = CategoryRule.builder()
            .member(familyMemberRepository.getReferenceById(memberId))
            .pattern(req.pattern())
            .expenseCategoryId(req.expenseCategoryId())
            .proStatus(req.proStatus())
            .build();
        rule = categoryRuleRepository.save(rule);
        applyToUncategorized(memberId);
        return toResponse(rule, Map.of(category.getId(), category));
    }

    @Transactional
    public CategoryRuleResponse update(Long id, CategoryRuleRequest req, Long memberId) {
        CategoryRule rule = getRuleOrThrow(id, memberId);
        ExpenseCategory category = getCategoryOrThrow(req.expenseCategoryId(), memberId);
        rule.setPattern(req.pattern());
        rule.setExpenseCategoryId(req.expenseCategoryId());
        rule.setProStatus(req.proStatus());
        rule = categoryRuleRepository.save(rule);
        applyToUncategorized(memberId);
        return toResponse(rule, Map.of(category.getId(), category));
    }

    @Transactional
    public void delete(Long id, Long memberId) {
        CategoryRule rule = getRuleOrThrow(id, memberId);
        categoryRuleRepository.delete(rule);
    }

    /** Matches every rule against every currently-uncategorized transaction of the member's,
     * first rule (creation order) to match wins per transaction. Category is always set on a
     * match; pro_status only when the rule specifies one AND the transaction's is still the
     * default NON_CLASSE -- a transaction someone already classified PERSO/PRO_ABSORBE/etc.
     * keeps that, even if uncategorized. Safe to call unconditionally: a no-op when there are
     * no rules or nothing left to classify. */
    @Transactional
    public void applyToUncategorized(Long memberId) {
        List<CategoryRule> rules = categoryRuleRepository.findAllByMemberIdOrderByIdAsc(memberId);
        if (rules.isEmpty()) return;

        List<Transaction> uncategorized = transactionRepository.findByAccount_Member_IdAndExpenseCategoryIdIsNull(memberId);
        if (uncategorized.isEmpty()) return;

        List<Transaction> changed = uncategorized.stream()
            .filter(t -> applyFirstMatch(t, rules))
            .toList();
        if (!changed.isEmpty()) {
            transactionRepository.saveAll(changed);
        }
    }

    /** Returns true (and mutates {@code t}) on the first rule whose pattern the description
     * contains, case-insensitively. */
    private boolean applyFirstMatch(Transaction t, List<CategoryRule> rules) {
        String description = t.getDescription() != null ? t.getDescription().toLowerCase(Locale.ROOT) : "";
        for (CategoryRule rule : rules) {
            if (!description.contains(rule.getPattern().toLowerCase(Locale.ROOT))) continue;
            t.setExpenseCategoryId(rule.getExpenseCategoryId());
            if (rule.getProStatus() != null && t.getProStatus() == ProStatus.NON_CLASSE) {
                t.setProStatus(rule.getProStatus());
            }
            return true;
        }
        return false;
    }

    private CategoryRuleResponse toResponse(CategoryRule rule, Map<Long, ExpenseCategory> categoriesById) {
        ExpenseCategory category = categoriesById.get(rule.getExpenseCategoryId());
        return CategoryRuleResponse.from(rule, category != null ? category.getName() : null, category != null ? category.getColor() : null);
    }

    private ExpenseCategory getCategoryOrThrow(Long categoryId, Long memberId) {
        return expenseCategoryRepository.findByIdAndMemberId(categoryId, memberId)
            .orElseThrow(() -> ResourceNotFoundException.expenseCategory(categoryId));
    }

    private CategoryRule getRuleOrThrow(Long id, Long memberId) {
        return categoryRuleRepository.findByIdAndMemberId(id, memberId)
            .orElseThrow(() -> ResourceNotFoundException.categoryRule(id));
    }
}
