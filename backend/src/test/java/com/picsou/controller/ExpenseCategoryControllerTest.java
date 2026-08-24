package com.picsou.controller;

import com.picsou.dto.ExpenseCategoryRequest;
import com.picsou.dto.ExpenseCategoryResponse;
import com.picsou.service.ExpenseCategoryService;
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
class ExpenseCategoryControllerTest {

    @Mock ExpenseCategoryService expenseCategoryService;
    @Mock UserContext userContext;

    @InjectMocks ExpenseCategoryController controller;

    @Test
    void findAll_usesMemberIdFromUserContext() {
        when(userContext.currentMemberId()).thenReturn(10L);
        List<ExpenseCategoryResponse> expected = List.of(new ExpenseCategoryResponse(1L, "Restauration", "#f97316"));
        when(expenseCategoryService.findAll(10L)).thenReturn(expected);

        List<ExpenseCategoryResponse> actual = controller.findAll();

        assertThat(actual).isSameAs(expected);
        verify(expenseCategoryService).findAll(10L);
    }

    @Test
    void create_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);
        ExpenseCategoryRequest req = new ExpenseCategoryRequest("Vacances", "#00ff00");
        ExpenseCategoryResponse expected = new ExpenseCategoryResponse(2L, "Vacances", "#00ff00");
        when(expenseCategoryService.create(req, 10L)).thenReturn(expected);

        ExpenseCategoryResponse actual = controller.create(req);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void delete_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);

        controller.delete(3L);

        verify(expenseCategoryService).delete(3L, 10L);
    }
}
