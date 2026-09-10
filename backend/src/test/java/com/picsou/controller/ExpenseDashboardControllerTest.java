package com.picsou.controller;

import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.dto.ExpensePaceResponse;
import com.picsou.dto.RecurringTransactionResponse;
import com.picsou.service.ExpenseDashboardService;
import com.picsou.service.RecurringTransactionService;
import com.picsou.service.UserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpenseDashboardControllerTest {

    @Mock ExpenseDashboardService expenseDashboardService;
    @Mock RecurringTransactionService recurringTransactionService;
    @Mock UserContext userContext;

    @InjectMocks ExpenseDashboardController controller;

    @Test
    void getDashboard_defaultsToSixMonthsAndCurrentMonth() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpenseDashboardResponse expected = new ExpenseDashboardResponse(List.of(), List.of(), BigDecimal.ZERO);
        YearMonth currentMonth = YearMonth.now();
        when(expenseDashboardService.getDashboard(10L, 6, currentMonth.atDay(1), currentMonth.atEndOfMonth(), false))
            .thenReturn(expected);

        ExpenseDashboardResponse actual = controller.getDashboard(6, null, null, false);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void getDashboard_usesExplicitMonthsAndPeriodRange() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpenseDashboardResponse expected = new ExpenseDashboardResponse(List.of(), List.of(), BigDecimal.ZERO);
        when(expenseDashboardService.getDashboard(10L, 3, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), false))
            .thenReturn(expected);

        ExpenseDashboardResponse actual = controller.getDashboard(3, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), false);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void getDashboard_acceptsAFullYearRange() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpenseDashboardResponse expected = new ExpenseDashboardResponse(List.of(), List.of(), BigDecimal.ZERO);
        when(expenseDashboardService.getDashboard(10L, 12, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31), false))
            .thenReturn(expected);

        ExpenseDashboardResponse actual = controller.getDashboard(12, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31), false);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void getDashboard_forwardsIncomeFlag() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpenseDashboardResponse expected = new ExpenseDashboardResponse(List.of(), List.of(), BigDecimal.ZERO);
        YearMonth currentMonth = YearMonth.now();
        when(expenseDashboardService.getDashboard(10L, 6, currentMonth.atDay(1), currentMonth.atEndOfMonth(), true))
            .thenReturn(expected);

        ExpenseDashboardResponse actual = controller.getDashboard(6, null, null, true);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void getPace_defaultsToThreeMonthsOfHistory() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpensePaceResponse expected = new ExpensePaceResponse(10, 31, 3, BigDecimal.ZERO, BigDecimal.ZERO, null, List.of(), List.of(), List.of());
        when(expenseDashboardService.getPace(10L, 3)).thenReturn(expected);

        ExpensePaceResponse actual = controller.getPace(3);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void getPace_usesExplicitHistoryMonths() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpensePaceResponse expected = new ExpensePaceResponse(10, 31, 6, BigDecimal.ZERO, BigDecimal.ZERO, null, List.of(), List.of(), List.of());
        when(expenseDashboardService.getPace(10L, 6)).thenReturn(expected);

        ExpensePaceResponse actual = controller.getPace(6);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void getRecurring_usesMemberIdFromUserContext() {
        when(userContext.currentMemberId()).thenReturn(10L);
        List<RecurringTransactionResponse> expected = List.of();
        when(recurringTransactionService.getRecurring(10L)).thenReturn(expected);

        assertThat(controller.getRecurring()).isSameAs(expected);
    }
}
