package com.picsou.repository;

import com.picsou.model.CategoryRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, Long> {
    /** Id order = creation order -- first-match-wins when more than one rule matches the
     * same transaction, applied in a stable, predictable sequence. */
    List<CategoryRule> findAllByMemberIdOrderByIdAsc(Long memberId);

    Optional<CategoryRule> findByIdAndMemberId(Long id, Long memberId);
}
