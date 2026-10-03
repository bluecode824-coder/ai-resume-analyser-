import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import ResumeCard from "~/components/ResumeCard";
import {usePuterStore} from "~/lib/puter";
import {Link, useLocation, useNavigate} from "react-router";
import {useCallback, useEffect, useState} from "react";

interface WipeNotice {
  deletedRecords: number;
  deletedFiles: number;
  fileFailures: string[];
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Resumind" },
    { name: "description", content: "Smart feedback for your dream job!" },
  ];
}

export default function Home() {
  const { auth, isLoading, kv } = usePuterStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [resumeLoadError, setResumeLoadError] = useState("");
  const [wipeNotice, setWipeNotice] = useState<WipeNotice | null>(null);

  const loadResumes = useCallback(async () => {
    setLoadingResumes(true);
    setResumeLoadError("");

    try {
      const items = await kv.list("resume:*", true);
      const parsedResumes = Array.isArray(items)
        ? items
            .filter((item): item is KVItem => typeof item !== "string")
            .map((item) => JSON.parse(item.value) as Resume)
        : [];

      setResumes(parsedResumes);
    } catch (error) {
      setResumeLoadError(error instanceof Error ? error.message : "Could not load saved resumes.");
      setResumes([]);
    } finally {
      setLoadingResumes(false);
    }
  }, [kv]);

  useEffect(() => {
    void loadResumes();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadResumes();
    };
    window.addEventListener("focus", loadResumes);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", loadResumes);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadResumes]);

  useEffect(() => {
    const notice = (location.state as { wipeNotice?: WipeNotice } | null)?.wipeNotice;
    setWipeNotice(notice ?? null);
  }, [location.key, location.state]);

  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated) navigate('/auth?next=/');
  }, [auth.isAuthenticated, isLoading, navigate]);

  return <main className="bg-[url('/images/bg-main.svg')] bg-cover">
    <Navbar />

    <section className="main-section">
      <div className="page-heading py-16">
        <h1>Track Your Applications & Resume Ratings</h1>
        {!loadingResumes && !resumeLoadError && resumes.length === 0 ? (
            <h2>No resumes found. Upload your first resume to get feedback.</h2>
        ): !resumeLoadError && (
          <h2>Review your submissions and check AI-powered feedback.</h2>
        )}
      </div>
      {wipeNotice && (
          <div className="mx-auto mb-8 max-w-3xl rounded-xl bg-green-50 p-4 text-green-800" role="status">
            <p>
              Removed {wipeNotice.deletedRecords} resume records and {wipeNotice.deletedFiles} uploaded files.
              The homepage is now clear.
            </p>
            {wipeNotice.fileFailures.length > 0 && (
                <p className="mt-2 text-amber-800">
                  {wipeNotice.fileFailures.length} file(s) could not be removed from Puter. Try the wipe again or check your Puter files.
                </p>
            )}
          </div>
      )}
      {resumeLoadError && (
          <p className="text-center text-red-700" role="alert">
            Could not load your saved resumes: {resumeLoadError}
          </p>
      )}
      {loadingResumes && (
          <div className="flex flex-col items-center justify-center">
            <img src="/images/resume-scan-2.gif" className="w-[200px]" />
          </div>
      )}

      {!loadingResumes && resumes.length > 0 && (
        <div className="resumes-section">
          {resumes.map((resume) => (
              <ResumeCard key={resume.id} resume={resume} />
          ))}
        </div>
      )}

      {!loadingResumes && !resumeLoadError && resumes.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-10 gap-4">
            <Link to="/upload" className="primary-button w-fit text-xl font-semibold">
              Upload Resume
            </Link>
          </div>
      )}
    </section>
  </main>
}
