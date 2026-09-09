package com.picsou.controller;

import com.picsou.dto.CategoryRuleRequest;
import com.picsou.dto.CategoryRuleResponse;
import com.picsou.model.ProStatus;
import com.picsou.service.CategoryRuleService;
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
class CategoryRuleControllerTest {

    @Mock CategoryRuleService categoryRuleService;
    @Mock UserContext userContext;

    @InjectMocks CategoryRuleController controller;

    @Test
    void findAll_usesMemberIdFromUserContext() {
        when(userContext.currentMemberId()).thenReturn(10L);
        List<CategoryRuleResponse> expected = List.of(new CategoryRuleResponse(1L, "carrefour", 1L, "Courses", "#22c55e", null));
        when(categoryRuleService.findAll(10L)).thenReturn(expected);

        List<CategoryRuleResponse> actual = controller.findAll();

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void create_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);
        CategoryRuleRequest req = new CategoryRuleRequest("salaire", 2L, ProStatus.PERSO);
        CategoryRuleResponse expected = new CategoryRuleResponse(5L, "salaire", 2L, "Salaire", "#22c55e", ProStatus.PERSO);
        when(categoryRuleService.create(req, 10L)).thenReturn(expected);

        CategoryRuleResponse actual = controller.create(req);

        assertThat(actual).isSameAs(expected);
    }

    @Test
    void delete_delegatesWithMemberId() {
        when(userContext.currentMemberId()).thenReturn(10L);

        controller.delete(3L);

        verify(categoryRuleService).delete(3L, 10L);
    }
}
