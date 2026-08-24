package com.picsou.service;

import com.picsou.dto.ExpenseCategoryRequest;
import com.picsou.dto.ExpenseCategoryResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.FamilyMember;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseCategoryServiceTest {

    @Mock ExpenseCategoryRepository expenseCategoryRepository;
    @Mock FamilyMemberRepository familyMemberRepository;

    @InjectMocks ExpenseCategoryService expenseCategoryService;

    private ExpenseCategory category(Long id, String name) {
        return ExpenseCategory.builder().id(id).name(name).color("#6366f1").build();
    }

    @Test
    void findAll_memberWithNoCategories_seedsTheNineDefaults() {
        FamilyMember member = FamilyMember.builder().id(10L).build();
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(expenseCategoryRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<ExpenseCategoryResponse> result = expenseCategoryService.findAll(10L);

        assertThat(result).hasSize(9);
        assertThat(result).extracting(ExpenseCategoryResponse::name)
            .contains("Restauration", "Courses", "Abonnements", "Transport", "Logement",
                "Santé", "Loisirs", "Matériel/Équipement", "Autre");
    }

    @Test
    void findAll_memberWithExistingCategories_doesNotReseed() {
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L))
            .thenReturn(List.of(category(1L, "Restauration")));

        List<ExpenseCategoryResponse> result = expenseCategoryService.findAll(10L);

        assertThat(result).hasSize(1);
        verify(expenseCategoryRepository, never()).saveAll(any());
        verify(familyMemberRepository, never()).getReferenceById(any());
    }

    @Test
    void create_duplicateNameForMember_throws() {
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Restauration")).thenReturn(true);

        assertThatThrownBy(() ->
            expenseCategoryService.create(new ExpenseCategoryRequest("Restauration", "#ffffff"), 10L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Restauration");

        verify(expenseCategoryRepository, never()).save(any());
    }

    @Test
    void create_newName_savesWithMemberAndColor() {
        FamilyMember member = FamilyMember.builder().id(10L).build();
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Vacances")).thenReturn(false);
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(expenseCategoryRepository.save(any(ExpenseCategory.class))).thenAnswer(inv -> {
            ExpenseCategory c = inv.getArgument(0);
            c.setId(42L);
            return c;
        });

        ExpenseCategoryResponse result = expenseCategoryService.create(new ExpenseCategoryRequest("Vacances", "#00ff00"), 10L);

        assertThat(result.id()).isEqualTo(42L);
        assertThat(result.name()).isEqualTo("Vacances");
        assertThat(result.color()).isEqualTo("#00ff00");

        ArgumentCaptor<ExpenseCategory> captor = ArgumentCaptor.forClass(ExpenseCategory.class);
        verify(expenseCategoryRepository).save(captor.capture());
        assertThat(captor.getValue().getMember()).isSameAs(member);
    }

    @Test
    void delete_wrongMember_throwsNotFound() {
        when(expenseCategoryRepository.findByIdAndMemberId(5L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> expenseCategoryService.delete(5L, 10L))
            .isInstanceOf(ResourceNotFoundException.class);

        verify(expenseCategoryRepository, never()).delete(any());
    }
}
