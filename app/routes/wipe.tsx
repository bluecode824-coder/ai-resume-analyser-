import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePuterStore } from "~/lib/puter";

const WipeApp = () => {
    const { auth, isLoading, kv, fs } = usePuterStore();
    const navigate = useNavigate();
    const [resumeCount, setResumeCount] = useState<number | null>(null);
    const [uploadedFileCount, setUploadedFileCount] = useState<number | null>(null);
    const [isWiping, setIsWiping] = useState(false);
    const [error, setError] = useState("");

    const loadResumeCount = useCallback(async () => {
        try {
            const [items, files] = await Promise.all([kv.list("resume:*", true), fs.readDir("./")]);
            setResumeCount(Array.isArray(items) ? items.filter((item) => typeof item !== "string").length : 0);
            setUploadedFileCount(
                Array.isArray(files)
                    ? files.filter((file) => !file.is_dir && /\.(pdf|png)$/i.test(file.name)).length
                    : 0
            );
            setError("");
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Could not load your saved resumes.");
        }
    }, [fs, kv]);

    useEffect(() => {
        if (!isLoading && !auth.isAuthenticated) {
            navigate("/auth?next=/wipe");
        }
    }, [auth.isAuthenticated, isLoading, navigate]);

    useEffect(() => {
        if (!isLoading && auth.isAuthenticated) {
            void loadResumeCount();
        }
    }, [auth.isAuthenticated, isLoading, loadResumeCount]);

    const handleDelete = async () => {
        if (!window.confirm("Delete all Resumind resume records, uploaded PDFs, and previews? This cannot be undone.")) {
            return;
        }

        setIsWiping(true);
        setError("");

        try {
            const items = await kv.list("resume:*", true);
            const records = Array.isArray(items)
                ? items.filter((item): item is KVItem => typeof item !== "string")
                : [];
            const filePaths = new Set<string>();
            const failures: string[] = [];

            for (const item of records) {
                try {
                    const resume = JSON.parse(item.value) as Partial<Resume>;
                    if (typeof resume.resumePath === "string") filePaths.add(resume.resumePath);
                    if (typeof resume.imagePath === "string") filePaths.add(resume.imagePath);
                } catch {
                    failures.push(`Could not read file paths from resume record ${item.key}; its uploaded files may remain.`);
                }
            }

            const storedFiles = await fs.readDir("./");
            if (!Array.isArray(storedFiles)) {
                throw new Error("Could not list app files from Puter, so uploaded resume files were not deleted.");
            }
            for (const file of storedFiles) {
                if (!file.is_dir && /\.(pdf|png)$/i.test(file.name)) {
                    filePaths.add(file.path);
                }
            }

            let deletedFiles = 0;
            let deletedRecords = 0;

            for (const path of filePaths) {
                try {
                    await fs.delete(path);
                    deletedFiles += 1;
                } catch (deleteError) {
                    const details = deleteError instanceof Error
                        ? deleteError.message
                        : JSON.stringify(deleteError);
                    failures.push(`File ${path}: ${details}`);
                }
            }

            for (const item of records) {
                try {
                    const deleted = await kv.delete(item.key);
                    if (!deleted) throw new Error("The record was not deleted.");
                    deletedRecords += 1;
                } catch (deleteError) {
                    failures.push(`Resume record ${item.key}: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
                }
            }

            const remainingItems = await kv.list("resume:*", true);
            const remainingRecords = Array.isArray(remainingItems)
                ? remainingItems.filter((item) => typeof item !== "string").length
                : 0;
            setResumeCount(remainingRecords);

            if (remainingRecords > 0) {
                failures.push(`${remainingRecords} resume record${remainingRecords === 1 ? "" : "s"} still remain in Puter.`);
            }

            if (remainingRecords === 0) {
                navigate("/", {
                    replace: true,
                    state: {
                        wipeNotice: {
                            deletedRecords,
                            deletedFiles,
                            fileFailures: failures,
                        },
                    },
                });
            } else {
                setError(`Deleted ${deletedRecords} of ${records.length} resume records and ${deletedFiles} of ${filePaths.size} files. Some items could not be deleted: ${failures.join("; ")}`);
            }
        } catch (wipeError) {
            setError(wipeError instanceof Error ? wipeError.message : "Could not delete the saved resume data.");
        } finally {
            setIsWiping(false);
        }
    };

    if (isLoading || !auth.isAuthenticated) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
            <Link to="/" className="font-semibold text-blue-700 underline">Back to resumes</Link>
            <section className="flex flex-col gap-4 rounded-2xl bg-white p-8 shadow">
                <h1 className="text-3xl font-bold">Manage saved resume data</h1>
                <p>Signed in as {auth.user?.username ?? "your Puter account"}.</p>
                <p>
                    {resumeCount === null
                        ? "Loading saved resume data..."
                        : `${resumeCount} saved resume${resumeCount === 1 ? "" : "s"} and ${uploadedFileCount ?? 0} PDF/PNG file${uploadedFileCount === 1 ? "" : "s"}.`}
                </p>
                <p className="text-gray-600">
                    This removes Resumind resume records and PDF/PNG files stored by this app.
                    It does not clear data used by other apps.
                </p>
                <button
                    className="w-fit rounded-md bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    onClick={handleDelete}
                    disabled={isWiping || resumeCount === null || (resumeCount === 0 && uploadedFileCount === 0)}
                >
                    {isWiping ? "Deleting resume data..." : "Delete all resume data"}
                </button>
                {error && <p className="break-words text-red-700" role="alert">{error}</p>}
            </section>
        </main>
    );
};

export default WipeApp;
