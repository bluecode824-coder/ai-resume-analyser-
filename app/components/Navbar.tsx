import {useState} from "react";
import {Link, useNavigate} from "react-router";
import {usePuterStore} from "~/lib/puter";

const Navbar = () => {
    const { auth, isLoading } = usePuterStore();
    const navigate = useNavigate();
    const [authError, setAuthError] = useState("");

    const handleSignOut = async () => {
        setAuthError("");
        try {
            await auth.signOut();
            navigate("/auth");
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Could not log out. Please try again.");
        }
    };

    return (
        <>
            <nav className="navbar !px-4 sm:!px-6 lg:!px-10">
                <Link to="/">
                    <p className="text-2xl font-bold text-gradient">RESUMIND</p>
                </Link>
                <div className="flex items-center gap-2 sm:gap-3">
                    <Link to="/upload" className="primary-button w-fit whitespace-nowrap !px-4 !py-2 text-sm sm:!px-5">
                        Upload resume
                    </Link>
                    {auth.isAuthenticated ? (
                        <details className="group relative">
                            <summary
                                aria-label={`Account menu for ${auth.user?.username || "user"}`}
                                className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:border-indigo-200 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden"
                            >
                                <span
                                    aria-hidden="true"
                                    className="flex size-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold uppercase text-indigo-700"
                                >
                                    {auth.user?.username?.charAt(0) || "U"}
                                </span>
                            </summary>
                            <div className="absolute right-0 z-50 mt-3 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                                <div className="border-b border-gray-100 px-3 py-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Signed in as</p>
                                    <p className="truncate pt-1 text-sm font-semibold text-gray-800">
                                        {auth.user?.username || "Account"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60"
                                    onClick={handleSignOut}
                                    disabled={isLoading}
                                >
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        className="size-4"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25V5.625A1.875 1.875 0 0 0 13.875 3.75h-7.5A1.875 1.875 0 0 0 4.5 5.625v12.75a1.875 1.875 0 0 0 1.875 1.875h7.5a1.875 1.875 0 0 0 1.875-1.875V15.75M10.5 12h9m0 0-3.75-3.75M19.5 12l-3.75 3.75" />
                                    </svg>
                                    {isLoading ? "Logging out..." : "Log out"}
                                </button>
                            </div>
                        </details>
                    ) : (
                        <Link
                            to="/auth"
                            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            Sign in
                        </Link>
                    )}
                </div>
            </nav>
            {authError && (
                <p className="mx-auto max-w-[1200px] px-6 pt-2 text-right text-sm text-red-700" role="alert">
                    {authError}
                </p>
            )}
        </>
    )
}
export default Navbar
