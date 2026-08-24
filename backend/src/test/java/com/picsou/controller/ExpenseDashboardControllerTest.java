package com.picsou.controller;

import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.service.ExpenseDashboardService;
import com.picsou.service.UserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpenseDashboardControllerTest {

    @Mock ExpenseDashboardService expenseDashboardService;
    @Mock UserContext userContext;

    @InjectMocks ExpenseDashboardController controller;

    @Test
    void getDashboard_defaultsToSixMonthsAndCurrentPeriod() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpenseDashboardResponse expected = new ExpenseDashboardResponse(List.of(), List.of(), BigDecimal.ZERO);
        when(expenseDashboardService.getDashboard(10L, 6, YearMonth.now())).thenReturn(expected);

        ExpenseDashboardResponse actual = controller.getDashboard(6, null);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void getDashboard_usesExplicitMonthsAndPeriod() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpenseDashboardResponse expected = new ExpenseDashboardResponse(List.of(), List.of(), BigDecimal.ZERO);
        when(expenseDashboardService.getDashboard(10L, 3, YearMonth.of(2026, 1))).thenReturn(expected);

        ExpenseDashboardResponse actual = controller.getDashboard(3, "2026-01");

        assertThat(actual).isSameAs(expected);
    }
}
