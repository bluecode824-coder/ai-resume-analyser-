import {Link, useNavigate, useParams} from "react-router";
import {useEffect, useState} from "react";
import {usePuterStore} from "~/lib/puter";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";
import {getAIErrorMessage, parseAIResumeFeedback} from "~/lib/feedback";
import {prepareResumeInstructions} from "../../constants";
import {extractPdfText} from "~/lib/pdf2img";
import {getResumeValidationError} from "~/lib/resumeValidation";

export const meta = () => ([
    { title: 'Resumind | Review ' },
    { name: 'description', content: 'Detailed overview of your resume' },
])

const Resume = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const { id } = useParams();
    const [imageUrl, setImageUrl] = useState('');
    const [resumeUrl, setResumeUrl] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [resumeData, setResumeData] = useState<Resume | null>(null);
    const [isLoadingResume, setIsLoadingResume] = useState(true);
    const [resumeLoadError, setResumeLoadError] = useState<string | null>(null);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if(!isLoading && !auth.isAuthenticated) navigate(`/auth?next=/resume/${id}`);
    }, [isLoading])

    useEffect(() => {
        const loadResume = async () => {
            try {
                const resume = await kv.get(`resume:${id}`);
                if(!resume) {
                    setResumeLoadError('This resume could not be found.');
                    return;
                }

                const data = JSON.parse(resume) as Resume;
                setResumeData(data);
                setFeedback(data.feedback ?? null);

                const resumeBlob = await fs.read(data.resumePath);
                if(resumeBlob) {
                    setResumeUrl(URL.createObjectURL(new Blob([resumeBlob], { type: 'application/pdf' })));
                }

                const imageBlob = await fs.read(data.imagePath);
                if(imageBlob) {
                    setImageUrl(URL.createObjectURL(imageBlob));
                }
            } catch (error) {
                console.error('Failed to load resume:', error);
                setResumeLoadError('This resume could not be loaded. Please try uploading it again.');
            } finally {
                setIsLoadingResume(false);
            }
        }

        loadResume();
    }, [id]);

    const generateFeedback = async () => {
        if (!resumeData || !id) return;

        setIsGeneratingFeedback(true);
        setFeedbackError(null);
        try {
            const resumeBlob = await fs.read(resumeData.resumePath);
            if (!resumeBlob) {
                throw new Error("The saved resume PDF could not be loaded. Please upload it again.");
            }
            const resumeText = await extractPdfText(resumeBlob);
            const validationError = getResumeValidationError(resumeText);
            if (validationError) throw new Error(validationError);

            const generatedFeedback = parseAIResumeFeedback(
                await ai.feedback(
                    resumeData.resumePath,
                    prepareResumeInstructions({
                        jobTitle: resumeData.jobTitle ?? "",
                        jobDescription: resumeData.jobDescription ?? "",
                        resumeText,
                    })
                )
            );
            const updatedData = { ...resumeData, feedback: generatedFeedback };
            const saved = await kv.set(`resume:${id}`, JSON.stringify(updatedData));
            if (!saved) {
                throw new Error("AI feedback was generated, but could not be saved. Please retry.");
            }

            setResumeData(updatedData);
            setFeedback(generatedFeedback);
        } catch (error) {
            setFeedbackError(getAIErrorMessage(error));
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    return (
        <main className="!pt-0">
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>
            <div className="flex flex-row w-full max-lg:flex-col-reverse">
                <section className="feedback-section bg-[url('/images/bg-small.svg') bg-cover h-[100vh] sticky top-0 items-center justify-center">
                    {imageUrl && resumeUrl && (
                        <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-wxl:h-fit w-fit">
                            <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={imageUrl}
                                    className="w-full h-full object-contain rounded-2xl"
                                    title="resume"
                                />
                            </a>
                        </div>
                    )}
                </section>
                <section className="feedback-section">
                    <h2 className="text-4xl !text-black font-bold">Resume Review</h2>
                    {resumeData && !isLoadingResume && (
                        <div className="mt-6 flex flex-col items-start gap-3">
                            <button
                                type="button"
                                className="primary-button"
                                onClick={generateFeedback}
                                disabled={isGeneratingFeedback}
                            >
                                {isGeneratingFeedback
                                    ? "Analyzing with AI..."
                                    : feedback
                                        ? "Regenerate AI feedback"
                                        : "Generate AI feedback"}
                            </button>
                            {feedbackError && (
                                <p className="text-red-700" role="alert">{feedbackError}</p>
                            )}
                        </div>
                    )}
                    {feedback ? (
                        <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                            <Summary feedback={feedback} />
                            <ATS score={feedback.ATS.score || 0} suggestions={feedback.ATS.tips || []} />
                            <Details feedback={feedback} />
                        </div>
                    ) : isLoadingResume ? (
                        <img src="/images/resume-scan-2.gif" className="w-full" />
                    ) : (
                        <div className="mt-6 flex flex-col gap-4 text-gray-600" role="status">
                            <p>{resumeLoadError ?? 'No AI feedback has been generated for this resume yet.'}</p>
                            {!resumeData && (
                                <Link to="/upload" className="primary-button w-fit">
                                    Upload a resume
                                </Link>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
export default Resume
