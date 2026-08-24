package com.picsou.repository;

import com.picsou.model.Reimbursement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReimbursementRepository extends JpaRepository<Reimbursement, Long> {
    List<Reimbursement> findAllByMemberIdOrderByCreatedAtDesc(Long memberId);

    Optional<Reimbursement> findByIdAndMemberId(Long id, Long memberId);

    boolean existsByTransactionId(Long transactionId);
}
