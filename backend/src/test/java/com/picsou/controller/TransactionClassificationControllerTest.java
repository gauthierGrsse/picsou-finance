package com.picsou.controller;

import com.picsou.dto.TransactionClassificationRequest;
import com.picsou.dto.TransactionResponse;
import com.picsou.model.ProStatus;
import com.picsou.service.TransactionClassificationService;
import com.picsou.service.UserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionClassificationControllerTest {

    @Mock TransactionClassificationService transactionClassificationService;
    @Mock UserContext userContext;

    @InjectMocks TransactionClassificationController controller;

    @Test
    void updateClassification_usesMemberIdFromUserContext() {
        when(userContext.currentMemberId()).thenReturn(10L);
        TransactionClassificationRequest req = new TransactionClassificationRequest(ProStatus.PERSO, null);
        TransactionResponse expected = new TransactionResponse(
            7L, null, "Restaurant", null, null, null, "EUR", null, false, null, null, null, null, null, null,
            ProStatus.PERSO, null, null, null);
        when(transactionClassificationService.updateClassification(1L, 7L, 10L, req)).thenReturn(expected);

        TransactionResponse actual = controller.updateClassification(1L, 7L, req);

        assertThat(actual).isSameAs(expected);
    }
}
