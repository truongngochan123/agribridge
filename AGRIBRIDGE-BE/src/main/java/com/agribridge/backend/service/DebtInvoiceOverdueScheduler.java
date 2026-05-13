package com.agribridge.backend.service;

import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.repository.InvoiceRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DebtInvoiceOverdueScheduler {

    private final InvoiceRepository invoiceRepository;

    @Scheduled(cron = "0 10 0 * * *")
    @Transactional
    public void markOverdueInvoices() {
        List<InvoiceEntity> invoices = invoiceRepository.findByStatusInAndDueDateBefore(
                List.of(InvoiceStatusEnum.UNPAID, InvoiceStatusEnum.PARTIAL, InvoiceStatusEnum.CREDIT_PENDING),
                LocalDate.now());
        invoices.forEach(invoice -> invoice.setStatus(InvoiceStatusEnum.OVERDUE));
        invoiceRepository.saveAll(invoices);
    }
}
