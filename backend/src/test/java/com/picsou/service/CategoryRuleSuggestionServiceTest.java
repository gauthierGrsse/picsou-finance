package com.picsou.service;

import com.picsou.dto.CategoryRuleSuggestionResponse;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.CategoryRule;
import com.picsou.model.DismissedRuleSuggestion;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.FamilyMember;
import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.CategoryRuleRepository;
import com.picsou.repository.DismissedRuleSuggestionRepository;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryRuleSuggestionServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock ExpenseCategoryRepository expenseCategoryRepository;
    @Mock CategoryRuleRepository categoryRuleRepository;
    @Mock DismissedRuleSuggestionRepository dismissedRuleSuggestionRepository;
    @Mock FamilyMemberRepository familyMemberRepository;

    private final LocalDate today = LocalDate.of(2026, 8, 20);

    private CategoryRuleSuggestionService service() {
        Clock fixed = Clock.fixed(today.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
        return new CategoryRuleSuggestionService(transactionRepository, expenseCategoryRepository,
            categoryRuleRepository, dismissedRuleSuggestionRepository, familyMemberRepository, fixed);
    }

    private Account account() {
        return Account.builder().id(1L).name("Compte").type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction tx(long id, String description, String amount, Long categoryId) {
        Transaction t = Transaction.builder().account(account()).date(LocalDate.of(2026, 6, 5))
            .description(description).amount(new BigDecimal(amount)).isManual(false)
            .nativeCurrency("EUR").proStatus(ProStatus.PERSO).build();
        t.setId(id);
        t.setExpenseCategoryId(categoryId);
        return t;
    }

    private void stubEmptyRulesAndDismissals() {
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of());
        when(dismissedRuleSuggestionRepository.findAllByMemberId(10L)).thenReturn(List.of());
    }

    @Test
    void suggestsAPatternThatIsConsistentlyOneCategory() {
        ExpenseCategory courses = ExpenseCategory.builder().id(1L).name("Courses").color("#22c55e").build();
        List<Transaction> window = List.of(
            tx(1, "CB CARREFOUR MARKET", "-42.10", 1L),
            tx(2, "CB CARREFOUR CITY", "-18.00", 1L),
            tx(3, "PAIEMENT CARREFOUR", "-51.30", 1L),
            tx(4, "CB CARREFOUR EXPRESS", "-9.90", null) // uncategorized -- would be caught
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, today.minusMonths(12), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of(courses));
        stubEmptyRulesAndDismissals();

        List<CategoryRuleSuggestionResponse> result = service().getSuggestions(10L);

        assertThat(result).anySatisfy(s -> {
            assertThat(s.pattern()).isEqualTo("carrefour");
            assertThat(s.expenseCategoryId()).isEqualTo(1L);
            assertThat(s.matchingCategorized()).isEqualTo(3);
            assertThat(s.matchingUncategorized()).isEqualTo(1);
            assertThat(s.dominantSharePercent()).isEqualTo(100);
        });
    }

    @Test
    void doesNotSuggestWhenNoSingleCategoryDominates() {
        ExpenseCategory a = ExpenseCategory.builder().id(1L).name("Courses").color("#22c55e").build();
        ExpenseCategory b = ExpenseCategory.builder().id(2L).name("Loisirs").color("#ec4899").build();
        List<Transaction> window = List.of(
            tx(1, "AMAZON MARKETPLACE", "-20", 1L),
            tx(2, "AMAZON MARKETPLACE", "-30", 2L),
            tx(3, "AMAZON MARKETPLACE", "-40", 2L),
            tx(4, "AMAZON MARKETPLACE", "-10", 1L)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, today.minusMonths(12), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of(a, b));
        stubEmptyRulesAndDismissals();

        assertThat(service().getSuggestions(10L)).noneMatch(s -> s.pattern().equals("amazon"));
    }

    @Test
    void doesNotSuggestWithFewerThanThreeCategorizedOccurrences() {
        ExpenseCategory courses = ExpenseCategory.builder().id(1L).name("Courses").color("#22c55e").build();
        List<Transaction> window = List.of(
            tx(1, "CB MONOPRIX", "-42.10", 1L),
            tx(2, "CB MONOPRIX", "-18.00", 1L),
            tx(3, "CB MONOPRIX", "-9.90", null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, today.minusMonths(12), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of(courses));
        stubEmptyRulesAndDismissals();

        assertThat(service().getSuggestions(10L)).noneMatch(s -> s.pattern().equals("monoprix"));
    }

    @Test
    void excludesAPatternAlreadyCoveredByAnExistingRule() {
        ExpenseCategory courses = ExpenseCategory.builder().id(1L).name("Courses").color("#22c55e").build();
        List<Transaction> window = List.of(
            tx(1, "CB CARREFOUR MARKET", "-42.10", 1L),
            tx(2, "CB CARREFOUR CITY", "-18.00", 1L),
            tx(3, "PAIEMENT CARREFOUR", "-51.30", 1L)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, today.minusMonths(12), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of(courses));
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L))
            .thenReturn(List.of(CategoryRule.builder().pattern("carref").expenseCategoryId(1L).build()));
        when(dismissedRuleSuggestionRepository.findAllByMemberId(10L)).thenReturn(List.of());

        assertThat(service().getSuggestions(10L)).noneMatch(s -> s.pattern().equals("carrefour"));
    }

    @Test
    void excludesADismissedPattern() {
        ExpenseCategory courses = ExpenseCategory.builder().id(1L).name("Courses").color("#22c55e").build();
        List<Transaction> window = List.of(
            tx(1, "CB CARREFOUR MARKET", "-42.10", 1L),
            tx(2, "CB CARREFOUR CITY", "-18.00", 1L),
            tx(3, "PAIEMENT CARREFOUR", "-51.30", 1L)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, today.minusMonths(12), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of(courses));
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of());
        when(dismissedRuleSuggestionRepository.findAllByMemberId(10L))
            .thenReturn(List.of(DismissedRuleSuggestion.builder().pattern("carrefour").build()));

        assertThat(service().getSuggestions(10L)).noneMatch(s -> s.pattern().equals("carrefour"));
    }

    @Test
    void dropsNearDuplicateOverlappingCandidates() {
        ExpenseCategory courses = ExpenseCategory.builder().id(1L).name("Courses").color("#22c55e").build();
        List<Transaction> window = new ArrayList<>();
        for (int i = 1; i <= 4; i++) window.add(tx(i, "CB CARREFOUR MARKET PARIS", "-40", 1L));
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, today.minusMonths(12), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of(courses));
        stubEmptyRulesAndDismissals();

        List<CategoryRuleSuggestionResponse> result = service().getSuggestions(10L);

        // "carrefour", "market" and "paris" all match the exact same 4 rows -- only one kept
        assertThat(result).hasSize(1);
    }

    @Test
    void dismiss_persistsANormalizedPatternOnce() {
        when(dismissedRuleSuggestionRepository.existsByMemberIdAndPattern(10L, "carrefour")).thenReturn(false);
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(FamilyMember.builder().id(10L).build());

        service().dismiss(10L, "  Carrefour  ");

        ArgumentCaptor<DismissedRuleSuggestion> captor = ArgumentCaptor.forClass(DismissedRuleSuggestion.class);
        verify(dismissedRuleSuggestionRepository).save(captor.capture());
        assertThat(captor.getValue().getPattern()).isEqualTo("carrefour");
    }

    @Test
    void dismiss_isANoOpWhenAlreadyDismissed() {
        when(dismissedRuleSuggestionRepository.existsByMemberIdAndPattern(10L, "carrefour")).thenReturn(true);

        service().dismiss(10L, "carrefour");

        verify(dismissedRuleSuggestionRepository, never()).save(any());
    }
}
