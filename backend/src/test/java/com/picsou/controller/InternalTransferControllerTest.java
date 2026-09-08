package com.picsou.controller;

import com.picsou.dto.LinkToManualAccountRequest;
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

import java.time.LocalDate;
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
    void markWithoutMatch_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);

        controller.markWithoutMatch(5L);

        verify(internalTransferService).markWithoutMatch(5L, 10L);
    }

    @Test
    void linkToNewManualTransaction_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);
        LinkToManualAccountRequest req = new LinkToManualAccountRequest(2L, "Vers mon compte cash", LocalDate.of(2026, 3, 1));
        TransactionResponse expected = com.picsou.dto.TransactionResponse.from(
            com.picsou.model.Transaction.builder()
                .id(20L)
                .account(com.picsou.model.Account.builder().id(2L).name("Cash").build())
                .date(LocalDate.of(2026, 3, 1))
                .description("Vers mon compte cash")
                .amount(java.math.BigDecimal.TEN)
                .isManual(true)
                .nativeCurrency("EUR")
                .proStatus(com.picsou.model.ProStatus.VIREMENT_INTERNE)
                .build());
        when(internalTransferService.linkToNewManualTransaction(5L, 2L, 10L, "Vers mon compte cash", LocalDate.of(2026, 3, 1)))
            .thenReturn(expected);

        TransactionResponse actual = controller.linkToNewManualTransaction(5L, req);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void unlink_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);

        controller.unlink(5L);

        verify(internalTransferService).unlink(5L, 10L);
    }
}
