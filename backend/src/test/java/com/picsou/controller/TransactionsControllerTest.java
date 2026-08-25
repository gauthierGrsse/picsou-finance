package com.picsou.controller;

import com.picsou.dto.TransactionResponse;
import com.picsou.service.TransactionQueryService;
import com.picsou.service.UserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionsControllerTest {

    @Mock TransactionQueryService transactionQueryService;
    @Mock UserContext userContext;

    @InjectMocks TransactionsController controller;

    @Test
    void findAll_delegatesWithMemberIdAndPeriod() {
        when(userContext.currentMemberId()).thenReturn(10L);
        List<TransactionResponse> expected = List.of();
        when(transactionQueryService.findAll(10L, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31))).thenReturn(expected);

        List<TransactionResponse> actual = controller.findAll(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

        assertThat(actual).isSameAs(expected);
    }
}
