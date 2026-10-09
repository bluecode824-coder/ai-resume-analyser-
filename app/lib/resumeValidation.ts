const resumeSections = [
    /\b(?:work|professional|employment)\s+experience\b|\bwork history\b|\bexperience\b/i,
    /\beducation(?:al background)?\b/i,
    /\b(?:technical )?skills\b|\bcore competencies\b|\btechnologies\b/i,
    /\b(?:selected )?projects\b/i,
    /\bcertifications?\b|\blicenses?\b/i,
    /\bprofessional summary\b|\bcareer summary\b|\bobjective\b/i,
];

export const getResumeValidationError = (text: string): string | null => {
    const normalizedText = text.trim();
    if (normalizedText.length < 180) {
        return "We couldn't read enough text from this PDF to verify it is a resume. Please upload a text-based resume PDF.";
    }

    const matchingSections = resumeSections.filter((pattern) => pattern.test(normalizedText)).length;
    const hasContactDetails =
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(normalizedText) ||
        /\b(?:linkedin\.com|github\.com)\b/i.test(normalizedText) ||
        /(?:\+?\d[\d\s().-]{7,}\d)/.test(normalizedText);
    const hasEmploymentEvidence =
        /\b(?:engineered|developed|managed|designed|led|created|delivered|implemented|improved|built)\b/i.test(normalizedText) &&
        /\b(?:19|20)\d{2}\b/.test(normalizedText);

    if (matchingSections < 2 || (!hasContactDetails && matchingSections < 3 && !hasEmploymentEvidence)) {
        return "This PDF doesn't appear to be a resume. Upload a resume with sections such as experience, education, skills, or projects.";
    }

    return null;
};
