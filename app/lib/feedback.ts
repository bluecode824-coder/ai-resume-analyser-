const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

type FeedbackTip = { type: "good" | "improve"; tip: string };
type DetailedFeedbackTip = FeedbackTip & { explanation: string };

const parseTip = (value: unknown, section: string, index: number): FeedbackTip => {
    if (!isRecord(value) || (value.type !== "good" && value.type !== "improve") || typeof value.tip !== "string") {
        throw new Error(`AI feedback contains an invalid ${section} tip at position ${index + 1}.`);
    }

    return { type: value.type, tip: value.tip };
};

function parseTipList(value: unknown, section: string, includeExplanation: false): FeedbackTip[];
function parseTipList(value: unknown, section: string, includeExplanation: true): DetailedFeedbackTip[];
function parseTipList(
    value: unknown,
    section: string,
    includeExplanation: boolean
): (FeedbackTip | DetailedFeedbackTip)[] {
    if (!Array.isArray(value)) {
        throw new Error(`AI feedback is missing the ${section} tips.`);
    }

    if (includeExplanation) {
        return value.map((tip, index) => {
            const normalizedTip = parseTip(tip, section, index);
            return {
                ...normalizedTip,
                explanation: isRecord(tip) && typeof tip.explanation === "string" ? tip.explanation : "",
            };
        });
    }

    return value.map((tip, index) => parseTip(tip, section, index));
}

export const parseAIResumeFeedback = (response: AIResponse | undefined): Feedback => {
    if (!response) {
        throw new Error("The AI service returned no response. Please try again.");
    }

    if (response.message.refusal) {
        throw new Error(response.message.refusal);
    }

    if (response.finish_reason === "length") {
        throw new Error("The AI response was cut off. Please try again.");
    }

    const content = response.message.content;
    const text = typeof content === "string"
        ? content
        : Array.isArray(content)
            ? content
                .map((part) => isRecord(part) && typeof part.text === "string" ? part.text : "")
                .filter(Boolean)
                .join("\n")
            : "";
    const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("The AI returned unreadable feedback. Please retry the analysis.");
    }

    if (!isRecord(parsed) || typeof parsed.isResume !== "boolean") {
        throw new Error("The AI couldn't confirm this document is a resume. Please upload a resume and try again.");
    }
    if (!parsed.isResume) {
        throw new Error("This document doesn't appear to be a resume, so no score was generated.");
    }

    if (!isRecord(parsed) || typeof parsed.overallScore !== "number" || !Number.isFinite(parsed.overallScore)) {
        throw new Error("The AI response is missing a valid overall score. Please retry the analysis.");
    }

    const getSection = (name: string) => {
        const section = parsed[name];
        if (!isRecord(section) || typeof section.score !== "number" || !Number.isFinite(section.score)) {
            throw new Error(`The AI response is missing a valid ${name} score. Please retry the analysis.`);
        }

        return {
            score: Math.max(0, Math.min(100, Math.round(section.score))),
            tips: section.tips,
        };
    };

    const ats = getSection("ATS");
    const toneAndStyle = getSection("toneAndStyle");
    const contentSection = getSection("content");
    const structure = getSection("structure");
    const skills = getSection("skills");

    const overallScore = Math.round(
        ats.score * 0.25 +
        contentSection.score * 0.3 +
        skills.score * 0.2 +
        structure.score * 0.15 +
        toneAndStyle.score * 0.1
    );

    return {
        overallScore,
        ATS: { score: ats.score, tips: parseTipList(ats.tips, "ATS", false) },
        toneAndStyle: { score: toneAndStyle.score, tips: parseTipList(toneAndStyle.tips, "tone and style", true) },
        content: { score: contentSection.score, tips: parseTipList(contentSection.tips, "content", true) },
        structure: { score: structure.score, tips: parseTipList(structure.tips, "structure", true) },
        skills: { score: skills.score, tips: parseTipList(skills.tips, "skills", true) },
    };
};

export const getAIErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);
    if (/429|rate.?limit|too many requests/i.test(message)) {
        return "The AI service is currently busy (rate limited). Please wait a minute and retry.";
    }
    return message || "AI analysis failed. Please try again.";
};
