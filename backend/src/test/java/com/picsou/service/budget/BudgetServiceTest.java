package com.picsou.service.budget;

import com.picsou.dto.BudgetRequest;
import com.picsou.dto.BudgetResponse;
import com.picsou.model.Budget;
import com.picsou.model.Category;
import com.picsou.model.CategoryKind;
import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.BudgetRepository;
import com.picsou.repository.CategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetServiceTest {

    @Mock BudgetRepository budgetRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock FamilyMemberRepository familyMemberRepository;
    @Mock BudgetSettingsService budgetSettingsService;

    @InjectMocks BudgetService service;

    private static final Long MEMBER_ID = 10L;

    private Budget budget(Long categoryId, String limit) {
        Category category = Category.builder()
            .id(categoryId).kind(CategoryKind.EXPENSE).name("Courses").color("#22c55e").build();
        return Budget.builder().id(1L).category(category).monthlyLimit(new BigDecimal(limit)).build();
    }

    private static Transaction tx(String amount, ProStatus status, ReimbursementStatus reimbursement) {
        return Transaction.builder()
            .amount(new BigDecimal(amount)).proStatus(status).reimbursementStatus(reimbursement).build();
    }

    private static Transaction tx(String amount) {
        return tx(amount, ProStatus.PERSO, null);
    }

    private void stubRows(List<Long> categoryIds, Transaction... rows) {
        when(transactionRepository.findByMemberIdAndCategoryIdInAndDateBetween(
            eq(MEMBER_ID), eq(categoryIds), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(rows));
    }

    @Test
    void findAll_computesSpentFromNegativeOutflow_underBudget() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(5L, "200.00")));
        // Leaf category (no children) → envelope scores its own category, not a subtree rollup.
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 5L))
            .thenReturn(List.of());
        // Expenses are stored negative — €150 spent shows up as -150.
        stubRows(List.of(5L), tx("-100.00"), tx("-50.00"));

        List<BudgetResponse> result = service.findAll(MEMBER_ID);

        assertThat(result).hasSize(1);
        BudgetResponse r = result.get(0);
        assertThat(r.spent()).isEqualByComparingTo("150.00");
        assertThat(r.remaining()).isEqualByComparingTo("50.00");
        assertThat(r.percent()).isEqualByComparingTo("75.00");
        assertThat(r.overBudget()).isFalse();
        assertThat(r.rollup()).isFalse(); // leaf envelope, not a subtree
    }

    @Test
    void findAll_flagsOverBudget_whenSpentExceedsLimit() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(5L, "200.00")));
        // Leaf category (no children) → envelope scores its own category, not a subtree rollup.
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 5L))
            .thenReturn(List.of());
        stubRows(List.of(5L), tx("-250.00"));

        BudgetResponse r = service.findAll(MEMBER_ID).get(0);

        assertThat(r.spent()).isEqualByComparingTo("250.00");
        assertThat(r.remaining()).isEqualByComparingTo("-50.00");
        assertThat(r.overBudget()).isTrue();
    }

    @Test
    void findAll_refundReducesSpent() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(5L, "200.00")));
        // Leaf category (no children) → envelope scores its own category, not a subtree rollup.
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 5L))
            .thenReturn(List.of());
        // −120 spent then +20 refund nets to −100 → €100 spent.
        stubRows(List.of(5L), tx("-120.00"), tx("20.00"));

        BudgetResponse r = service.findAll(MEMBER_ID).get(0);

        assertThat(r.spent()).isEqualByComparingTo("100.00");
        assertThat(r.remaining()).isEqualByComparingTo("100.00");
    }

    @Test
    void findAll_rollsUpSubtreeSpend_forParentEnvelope() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(7L, "1000.00")));
        // Category 7 is a parent with two children → envelope rolls up the whole subtree.
        Category child1 = Category.builder().id(5L).kind(CategoryKind.EXPENSE).name("Courses").color("#22c55e").build();
        Category child2 = Category.builder().id(6L).kind(CategoryKind.EXPENSE).name("Loyer").color("#22c55e").build();
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 7L))
            .thenReturn(List.of(child1, child2));
        // The parent's own rows and both children's, stored negative.
        stubRows(List.of(7L, 5L, 6L), tx("-300.00"), tx("-400.00"), tx("-100.00"));

        BudgetResponse r = service.findAll(MEMBER_ID).get(0);

        assertThat(r.rollup()).isTrue();
        assertThat(r.spent()).isEqualByComparingTo("800.00");
        assertThat(r.remaining()).isEqualByComparingTo("200.00");
        assertThat(r.overBudget()).isFalse();
    }

    @Test
    void findAll_splitsSpentByProStatus_andTheBucketsAddUpToSpent() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(5L, "300.00")));
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 5L))
            .thenReturn(List.of());
        stubRows(List.of(5L),
            tx("-310.00", ProStatus.PERSO, null),
            tx("-140.00", ProStatus.PRO_ABSORBE, null),
            tx("-60.00", ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.EN_ATTENTE),
            tx("-25.00", ProStatus.NON_CLASSE, null));

        BudgetResponse r = service.findAll(MEMBER_ID).get(0);

        assertThat(r.proBreakdown().perso()).isEqualByComparingTo("310.00");
        assertThat(r.proBreakdown().proAbsorbe()).isEqualByComparingTo("140.00");
        assertThat(r.proBreakdown().proPending()).isEqualByComparingTo("60.00");
        assertThat(r.proBreakdown().unclassified()).isEqualByComparingTo("25.00");
        assertThat(r.proBreakdown().reimbursed()).isEqualByComparingTo("0");
        // Pro spend still counts toward the cap: the cash has left the account.
        assertThat(r.spent()).isEqualByComparingTo("535.00");
        assertThat(r.overBudget()).isTrue();
    }

    @Test
    void findAll_leavesSettledReimbursementsOut_butReportsThem() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(5L, "300.00")));
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 5L))
            .thenReturn(List.of());
        stubRows(List.of(5L),
            tx("-80.00", ProStatus.PERSO, null),
            tx("-120.00", ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.REMBOURSE));

        BudgetResponse r = service.findAll(MEMBER_ID).get(0);

        // The reimbursed 120 is a net-zero round trip, not spending: same rule as the dashboard.
        assertThat(r.spent()).isEqualByComparingTo("80.00");
        assertThat(r.remaining()).isEqualByComparingTo("220.00");
        assertThat(r.proBreakdown().reimbursed()).isEqualByComparingTo("120.00");
        assertThat(r.proBreakdown().proPending()).isEqualByComparingTo("0");
    }

    @Test
    void findAll_ignoresInternalTransferLegs() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(5L, "300.00")));
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 5L))
            .thenReturn(List.of());
        stubRows(List.of(5L),
            tx("-50.00", ProStatus.PERSO, null),
            tx("-200.00", ProStatus.VIREMENT_INTERNE, null));

        BudgetResponse r = service.findAll(MEMBER_ID).get(0);

        assertThat(r.spent()).isEqualByComparingTo("50.00");
        assertThat(r.proBreakdown().perso()).isEqualByComparingTo("50.00");
    }

    @Test
    void findAll_refundKeepsItsOwnBucket() {
        when(budgetSettingsService.cycleStartDay(MEMBER_ID)).thenReturn(1);
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(MEMBER_ID))
            .thenReturn(List.of(budget(5L, "300.00")));
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 5L))
            .thenReturn(List.of());
        stubRows(List.of(5L),
            tx("-100.00", ProStatus.PERSO, null),
            tx("30.00", ProStatus.PERSO, null),
            tx("-40.00", ProStatus.PRO_ABSORBE, null));

        BudgetResponse r = service.findAll(MEMBER_ID).get(0);

        assertThat(r.proBreakdown().perso()).isEqualByComparingTo("70.00");
        assertThat(r.proBreakdown().proAbsorbe()).isEqualByComparingTo("40.00");
        assertThat(r.spent()).isEqualByComparingTo("110.00");
    }

    @Test
    void create_rejects_whenParentAlreadyBudgeted() {
        Category parent = Category.builder()
            .id(7L).kind(CategoryKind.EXPENSE).name("Maison").color("#22c55e").build();
        Category child = Category.builder()
            .id(5L).kind(CategoryKind.EXPENSE).name("Courses").color("#22c55e").parent(parent).build();
        when(categoryRepository.findByIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.of(child));
        when(budgetRepository.existsByMemberIdAndCategoryId(MEMBER_ID, 5L)).thenReturn(false);
        when(budgetRepository.existsByMemberIdAndCategoryId(MEMBER_ID, 7L)).thenReturn(true);

        assertThatThrownBy(() -> service.create(new BudgetRequest(5L, new BigDecimal("100.00")), MEMBER_ID))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("parent already has a budget");
    }

    @Test
    void create_rejects_whenChildAlreadyBudgeted() {
        Category parent = Category.builder()
            .id(7L).kind(CategoryKind.EXPENSE).name("Maison").color("#22c55e").build();
        Category child = Category.builder()
            .id(5L).kind(CategoryKind.EXPENSE).name("Courses").color("#22c55e").parent(parent).build();
        when(categoryRepository.findByIdAndMemberId(7L, MEMBER_ID)).thenReturn(Optional.of(parent));
        when(budgetRepository.existsByMemberIdAndCategoryId(MEMBER_ID, 7L)).thenReturn(false);
        when(categoryRepository.findAllByMemberIdAndParentIdOrderBySortOrderAscIdAsc(MEMBER_ID, 7L))
            .thenReturn(List.of(child));
        when(budgetRepository.existsByMemberIdAndCategoryId(MEMBER_ID, 5L)).thenReturn(true);

        assertThatThrownBy(() -> service.create(new BudgetRequest(7L, new BigDecimal("500.00")), MEMBER_ID))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("sub-category of this category already has a budget");
    }
}
