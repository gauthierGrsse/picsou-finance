package com.picsou.controller;

import com.picsou.dto.SuggestedTransferPairResponse;
import com.picsou.dto.TransactionResponse;
import com.picsou.dto.TransferLinkRequest;
import com.picsou.service.InternalTransferService;
import com.picsou.service.UserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InternalTransferControllerTest {

    @Mock InternalTransferService internalTransferService;
    @Mock UserContext userContext;

    @InjectMocks InternalTransferController controller;

    @Test
    void findSuggestions_usesMemberIdFromUserContext() {
        when(userContext.currentMemberId()).thenReturn(10L);
        List<SuggestedTransferPairResponse> expected = List.of();
        when(internalTransferService.findSuggestions(10L)).thenReturn(expected);

        List<SuggestedTransferPairResponse> actual = controller.findSuggestions();

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void findCandidates_usesMemberIdFromUserContext() {
        when(userContext.currentMemberId()).thenReturn(10L);
        List<TransactionResponse> expected = List.of();
        when(internalTransferService.findCandidates(10L)).thenReturn(expected);

        List<TransactionResponse> actual = controller.findCandidates();

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void confirmLink_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);
        TransferLinkRequest req = new TransferLinkRequest(1L, 2L, false);

        controller.confirmLink(req);

        verify(internalTransferService).confirmLink(1L, 2L, 10L, false);
    }

    @Test
    void confirmLink_forwardsAllowAmountMismatch() {
        when(userContext.currentMemberId()).thenReturn(10L);
        TransferLinkRequest req = new TransferLinkRequest(1L, 2L, true);

        controller.confirmLink(req);

        verify(internalTransferService).confirmLink(1L, 2L, 10L, true);
    }

    @Test
    void unlink_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);

        controller.unlink(5L);

        verify(internalTransferService).unlink(5L, 10L);
    }
}
