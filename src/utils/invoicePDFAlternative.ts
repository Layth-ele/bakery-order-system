/**
 * Invoice PDF Generator - Alternative Method using html-to-image
 * 
 * Backup solution if html2canvas fails with oklch colors
 * Uses html-to-image library which handles modern CSS better
 * 
 * ✅ FEB 7, 2026: Added page numbers and proper A4 pagination
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Capture modal content and generate PDF using html-to-image with page numbers
 * @param elementId - ID of the element to capture
 * @param filename - Name for the downloaded PDF file
 */
export async function downloadInvoiceAsPDFAlt(
  elementId: string,
  filename: string = 'invoice.pdf'
): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    // Use html-to-image which supports modern CSS
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2, // High quality
      backgroundColor: '#ffffff',
      cacheBust: true, // Bust cache to avoid color issues
    });

    // Create image to get dimensions
    const img = new Image();
    img.src = dataUrl;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 15; // Add margins
    const contentWidth = imgWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2) - 10; // Extra space for page numbers
    const imgHeight = (img.height * contentWidth) / img.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Calculate total pages
    const totalPages = Math.ceil(imgHeight / contentHeight);
    let currentPage = 1;
    
    // Add first page
    pdf.addImage(dataUrl, 'PNG', margin, margin, contentWidth, imgHeight);
    heightLeft -= contentHeight;

    // Add page number
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${currentPage} of ${totalPages}`,
      imgWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    // Add remaining pages
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      currentPage++;
      
      pdf.addImage(dataUrl, 'PNG', margin, position + margin, contentWidth, imgHeight);
      heightLeft -= contentHeight;
      
      // Add page number
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Page ${currentPage} of ${totalPages}`,
        imgWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    pdf.save(filename);
    
  } catch (error) {
    console.error('Error generating PDF (alternative method):', error);
    throw error;
  }
}

/**
 * Open PDF in new window
 */
export async function openInvoiceAsPDFAlt(
  elementId: string
): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    });

    const img = new Image();
    img.src = dataUrl;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (img.height * imgWidth) / img.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    const pdf = new jsPDF('p', 'mm', 'a4');
    
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob!);
    window.open(pdfUrl, '_blank');
    
  } catch (error) {
    console.error('Error generating PDF (alternative method):', error);
    throw error;
  }
}