package com.picsou.repository;

import com.picsou.model.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, Long> {
    List<ExpenseCategory> findAllByMemberIdOrderByNameAsc(Long memberId);

    Optional<ExpenseCategory> findByIdAndMemberId(Long id, Long memberId);

    boolean existsByMemberIdAndNameIgnoreCase(Long memberId, String name);
}
