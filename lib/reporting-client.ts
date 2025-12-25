import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface ValidationIssue {
    row: number;
    column?: string;
    message: string;
    severity: 'ERROR' | 'WARNING';
}

interface ValidationSummary {
    total: number;
    valid: number;
    merged: number;
    errors: number;
}

export function generateValidationPDF(filename: string, issues: ValidationIssue[], summary: ValidationSummary) {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 192, 139); // Primary Teal
    doc.text("QuantEdge Portfolio Validation Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), "PPP pp")}`, 14, 28);
    doc.text(`File: ${filename}`, 14, 34);

    // Summary Stats
    doc.setDrawColor(200);
    doc.line(14, 40, 196, 40);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Summary", 14, 50);

    const stats = [
        ["Total Rows Scanned", summary.total.toString()],
        ["Valid Holdings", summary.valid.toString()],
        ["Merged Holdings", summary.merged.toString()],
        ["Blocking Errors", summary.errors.toString()],
        ["Warnings", issues.filter(i => i.severity === 'WARNING').length.toString()]
    ];

    autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Count']],
        body: stats,
        theme: 'striped',
        headStyles: { fillColor: [0, 192, 139] },
        margin: { left: 14, right: 140 } // Narrow table
    });

    // Detailed Issues
    const currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Detailed Issues", 14, currentY);

    const rows = issues.map(i => [
        i.severity,
        i.row.toString(),
        i.column || "-",
        i.message
    ]);

    autoTable(doc, {
        startY: currentY + 5,
        head: [['Severity', 'Row', 'Column', 'Message']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 60] },
        styles: { fontSize: 8 },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [200, 50, 50] }, // Severity column Red-ish
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 0) {
                if (data.cell.raw === 'WARNING') {
                    data.cell.styles.textColor = [200, 150, 0]; // Orange for Warning
                }
            }
        }
    });

    // Save
    doc.save(`validation_report_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

export function generateValidationCSV(issues: ValidationIssue[]) {
    const headers = ["Severity,Row,Column,Message"];
    const rows = issues.map(i => `${i.severity},${i.row},${i.column || ""},"${i.message.replace(/"/g, '""')}"`);
    const csvContent = headers.concat(rows).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `validation_issues_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
