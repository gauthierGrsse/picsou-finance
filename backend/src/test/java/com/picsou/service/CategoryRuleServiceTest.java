package com.picsou.service;

import com.picsou.dto.CategoryRuleRequest;
import com.picsou.dto.CategoryRuleResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.CategoryRule;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.FamilyMember;
import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.CategoryRuleRepository;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryRuleServiceTest {

    @Mock CategoryRuleRepository categoryRuleRepository;
    @Mock ExpenseCategoryRepository expenseCategoryRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock FamilyMemberRepository familyMemberRepository;

    @InjectMocks CategoryRuleService categoryRuleService;

    private ExpenseCategory category(Long id, String name) {
        return ExpenseCategory.builder().id(id).name(name).color("#22c55e").build();
    }

    private Account account() {
        return Account.builder().id(1L).name("Compte").type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction tx(Long id, String description, ProStatus proStatus, Long expenseCategoryId) {
        Transaction t = Transaction.builder().account(account()).date(LocalDate.of(2026, 1, 5))
            .description(description).amount(new BigDecimal("-10")).isManual(false).nativeCurrency("EUR")
            .proStatus(proStatus).build();
        t.setId(id);
        t.setExpenseCategoryId(expenseCategoryId);
        return t;
    }

    private CategoryRule rule(Long id, String pattern, Long expenseCategoryId, ProStatus proStatus) {
        return CategoryRule.builder().id(id).pattern(pattern).expenseCategoryId(expenseCategoryId).proStatus(proStatus).build();
    }

    @Test
    void create_categoryBelongingToAnotherMember_throwsNotFound() {
        when(expenseCategoryRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            categoryRuleService.create(new CategoryRuleRequest("Carrefour", 1L, null), 10L))
            .isInstanceOf(ResourceNotFoundException.class);

        verify(categoryRuleRepository, never()).save(any());
    }

    @Test
    void create_savesAndAppliesRetroactivelyToUncategorizedTransactions() {
        ExpenseCategory courses = category(1L, "Courses");
        FamilyMember member = FamilyMember.builder().id(10L).build();
        when(expenseCategoryRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(courses));
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(categoryRuleRepository.save(any(CategoryRule.class))).thenAnswer(inv -> {
            CategoryRule r = inv.getArgument(0);
            r.setId(5L);
            return r;
        });
        CategoryRule saved = rule(5L, "carrefour", 1L, null);
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of(saved));
        Transaction matching = tx(1L, "CB CARREFOUR MARKET", ProStatus.NON_CLASSE, null);
        when(transactionRepository.findByAccount_Member_IdAndExpenseCategoryIdIsNull(10L)).thenReturn(List.of(matching));

        CategoryRuleResponse result = categoryRuleService.create(new CategoryRuleRequest("carrefour", 1L, null), 10L);

        assertThat(result.categoryName()).isEqualTo("Courses");
        ArgumentCaptor<List<Transaction>> captor = ArgumentCaptor.forClass(List.class);
        verify(transactionRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).getExpenseCategoryId()).isEqualTo(1L);
    }

    @Test
    void delete_wrongMember_throwsNotFound() {
        when(categoryRuleRepository.findByIdAndMemberId(5L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> categoryRuleService.delete(5L, 10L))
            .isInstanceOf(ResourceNotFoundException.class);

        verify(categoryRuleRepository, never()).delete(any());
    }

    // ─── applyToUncategorized() ─────────────────────────────────────────────

    @Test
    void applyToUncategorized_noRules_doesNothing() {
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of());

        categoryRuleService.applyToUncategorized(10L);

        verify(transactionRepository, never()).findByAccount_Member_IdAndExpenseCategoryIdIsNull(any());
        verify(transactionRepository, never()).saveAll(any());
    }

    @Test
    void applyToUncategorized_matchesCaseInsensitivelyAndSetsCategory() {
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of(rule(1L, "carrefour", 1L, null)));
        Transaction matching = tx(1L, "CB CARREFOUR MARKET PARIS", ProStatus.NON_CLASSE, null);
        Transaction nonMatching = tx(2L, "SNCF CONNECT", ProStatus.NON_CLASSE, null);
        when(transactionRepository.findByAccount_Member_IdAndExpenseCategoryIdIsNull(10L)).thenReturn(List.of(matching, nonMatching));

        categoryRuleService.applyToUncategorized(10L);

        ArgumentCaptor<List<Transaction>> captor = ArgumentCaptor.forClass(List.class);
        verify(transactionRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).getId()).isEqualTo(1L);
        assertThat(matching.getExpenseCategoryId()).isEqualTo(1L);
        assertThat(nonMatching.getExpenseCategoryId()).isNull();
    }

    @Test
    void applyToUncategorized_setsProStatusOnlyWhenRuleSpecifiesOneAndTransactionIsStillDefault() {
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of(rule(1L, "salaire", 2L, ProStatus.PERSO)));
        Transaction untouched = tx(1L, "VIREMENT SALAIRE", ProStatus.NON_CLASSE, null);
        Transaction alreadyClassified = tx(2L, "VIREMENT SALAIRE BIS", ProStatus.PRO_ABSORBE, null); // status manually set, don't override
        when(transactionRepository.findByAccount_Member_IdAndExpenseCategoryIdIsNull(10L)).thenReturn(List.of(untouched, alreadyClassified));

        categoryRuleService.applyToUncategorized(10L);

        assertThat(untouched.getExpenseCategoryId()).isEqualTo(2L);
        assertThat(untouched.getProStatus()).isEqualTo(ProStatus.PERSO);
        assertThat(alreadyClassified.getExpenseCategoryId()).isEqualTo(2L); // category still fills in
        assertThat(alreadyClassified.getProStatus()).isEqualTo(ProStatus.PRO_ABSORBE); // status left alone
    }

    @Test
    void applyToUncategorized_neverTouchesAnAlreadyCategorizedTransaction() {
        // findByAccount_Member_IdAndExpenseCategoryIdIsNull already excludes these at the
        // query level -- this asserts the repository call itself is scoped that way.
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of(rule(1L, "carrefour", 1L, null)));
        when(transactionRepository.findByAccount_Member_IdAndExpenseCategoryIdIsNull(10L)).thenReturn(List.of());

        categoryRuleService.applyToUncategorized(10L);

        verify(transactionRepository).findByAccount_Member_IdAndExpenseCategoryIdIsNull(10L);
        verify(transactionRepository, never()).saveAll(any());
    }

    @Test
    void applyToUncategorized_firstMatchingRuleInCreationOrderWins() {
        when(categoryRuleRepository.findAllByMemberIdOrderByIdAsc(10L)).thenReturn(List.of(
            rule(1L, "carrefour", 1L, null),
            rule(2L, "market", 2L, null) // "CARREFOUR MARKET" matches both -- rule 1 (lower id) wins
        ));
        Transaction matching = tx(1L, "CARREFOUR MARKET", ProStatus.NON_CLASSE, null);
        when(transactionRepository.findByAccount_Member_IdAndExpenseCategoryIdIsNull(10L)).thenReturn(List.of(matching));

        categoryRuleService.applyToUncategorized(10L);

        assertThat(matching.getExpenseCategoryId()).isEqualTo(1L);
    }
}
