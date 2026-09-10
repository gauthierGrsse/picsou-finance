package com.picsou.repository;

import com.picsou.model.DismissedRuleSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DismissedRuleSuggestionRepository extends JpaRepository<DismissedRuleSuggestion, Long> {
    List<DismissedRuleSuggestion> findAllByMemberId(Long memberId);

    boolean existsByMemberIdAndPattern(Long memberId, String pattern);
}
