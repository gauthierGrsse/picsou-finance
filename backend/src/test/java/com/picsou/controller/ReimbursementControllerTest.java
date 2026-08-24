package com.picsou.controller;

import com.picsou.dto.LinkExpensesRequest;
import com.picsou.dto.PendingReimbursementsResponse;
import com.picsou.dto.ReimbursementRequest;
import com.picsou.dto.ReimbursementResponse;
import com.picsou.service.ReimbursementService;
import com.picsou.service.UserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReimbursementControllerTest {

    @Mock ReimbursementService reimbursementService;
    @Mock UserContext userContext;

    @InjectMocks ReimbursementController controller;

    @Test
    void findPending_usesMemberIdFromUserContext() {
        when(userContext.currentMemberId()).thenReturn(10L);
        PendingReimbursementsResponse expected = new PendingReimbursementsResponse(List.of(), BigDecimal.ZERO);
        when(reimbursementService.findPending(10L)).thenReturn(expected);

        PendingReimbursementsResponse actual = controller.findPending();

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void create_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ReimbursementRequest req = new ReimbursementRequest(50L, List.of(1L, 2L));

        controller.create(req);

        verify(reimbursementService).create(req, 10L);
    }

    @Test
    void addExpenses_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);
        LinkExpensesRequest req = new LinkExpensesRequest(List.of(3L));

        controller.addExpenses(1L, req);

        verify(reimbursementService).addExpenses(1L, req, 10L);
    }

    @Test
    void unlinkExpense_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);

        controller.unlinkExpense(1L, 3L);

        verify(reimbursementService).unlinkExpense(1L, 3L, 10L);
    }

    @Test
    void delete_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);

        controller.delete(1L);

        verify(reimbursementService).delete(1L, 10L);
    }
}
