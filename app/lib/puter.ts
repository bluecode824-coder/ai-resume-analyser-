import { create } from "zustand";

const DEMO_PREFIX = "resumind-demo:";

const getDemoValue = <T>(key: string, fallback: T): T => {
    if (typeof window === "undefined") return fallback;

    try {
        const raw = window.localStorage.getItem(`${DEMO_PREFIX}${key}`);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

const setDemoValue = <T>(key: string, value: T) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`${DEMO_PREFIX}${key}`, JSON.stringify(value));
};

const removeDemoValue = (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(`${DEMO_PREFIX}${key}`);
};

declare global {
    interface Window {
        puter: {
            auth: {
                getUser: () => Promise<PuterUser>;
                isSignedIn: () => Promise<boolean>;
                signIn: () => Promise<void>;
                signOut: () => Promise<void>;
            };
            fs: {
                write: (
                    path: string,
                    data: string | File | Blob
                ) => Promise<File | undefined>;
                read: (path: string) => Promise<Blob>;
                upload: (file: File[] | Blob[]) => Promise<FSItem>;
                delete: (path: string) => Promise<void>;
                readdir: (path: string) => Promise<FSItem[] | undefined>;
            };
            ai: {
                chat: (
                    prompt: string | ChatMessage[],
                    imageURL?: string | PuterChatOptions,
                    testMode?: boolean,
                    options?: PuterChatOptions
                ) => Promise<Object>;
                img2txt: (
                    image: string | File | Blob,
                    testMode?: boolean
                ) => Promise<string>;
            };
            kv: {
                get: (key: string) => Promise<string | null>;
                set: (key: string, value: string) => Promise<boolean>;
                del: (key: string) => Promise<boolean>;
                list: (pattern: string, returnValues?: boolean) => Promise<string[]>;
                flush: () => Promise<boolean>;
            };
        };
    }
}

interface PuterStore {
    isLoading: boolean;
    error: string | null;
    puterReady: boolean;
    auth: {
        user: PuterUser | null;
        isAuthenticated: boolean;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
        refreshUser: () => Promise<void>;
        checkAuthStatus: () => Promise<boolean>;
        getUser: () => PuterUser | null;
    };
    fs: {
        write: (
            path: string,
            data: string | File | Blob
        ) => Promise<File | undefined>;
        read: (path: string) => Promise<Blob | undefined>;
        upload: (file: File[] | Blob[]) => Promise<FSItem | undefined>;
        delete: (path: string) => Promise<void>;
        readDir: (path: string) => Promise<FSItem[] | undefined>;
    };
    ai: {
        chat: (
            prompt: string | ChatMessage[],
            imageURL?: string | PuterChatOptions,
            testMode?: boolean,
            options?: PuterChatOptions
        ) => Promise<AIResponse | undefined>;
        feedback: (
            path: string,
            message: string
        ) => Promise<AIResponse | undefined>;
        img2txt: (
            image: string | File | Blob,
            testMode?: boolean
        ) => Promise<string | undefined>;
    };
    kv: {
        get: (key: string) => Promise<string | null | undefined>;
        set: (key: string, value: string) => Promise<boolean | undefined>;
        delete: (key: string) => Promise<boolean | undefined>;
        list: (
            pattern: string,
            returnValues?: boolean
        ) => Promise<string[] | KVItem[] | undefined>;
        flush: () => Promise<boolean | undefined>;
    };

    init: () => void;
    clearError: () => void;
}

const getPuter = (): typeof window.puter | null =>
    typeof window !== "undefined" && window.puter ? window.puter : null;

export const usePuterStore = create<PuterStore>((set, get) => {
    const setError = (msg: string) => {
        set({
            error: msg,
            isLoading: false,
            auth: {
                user: null,
                isAuthenticated: false,
                signIn: get().auth.signIn,
                signOut: get().auth.signOut,
                refreshUser: get().auth.refreshUser,
                checkAuthStatus: get().auth.checkAuthStatus,
                getUser: get().auth.getUser,
            },
        });
    };

    const applyDemoAuth = (user: PuterUser | null, message?: string | null) => {
        set({
            auth: {
                user,
                isAuthenticated: !!user,
                signIn: get().auth.signIn,
                signOut: get().auth.signOut,
                refreshUser: get().auth.refreshUser,
                checkAuthStatus: get().auth.checkAuthStatus,
                getUser: () => user,
            },
            isLoading: false,
            error: message ?? null,
        });
    };

    const checkAuthStatus = async (): Promise<boolean> => {
        const demoUser = getDemoValue<PuterUser | null>("user", null);
        const puter = getPuter();
        if (!puter) {
            applyDemoAuth(demoUser, demoUser ? null : "Puter.js not available; using demo mode");
            return !!demoUser;
        }

        set({ isLoading: true, error: null });

        try {
            const isSignedIn = await puter.auth.isSignedIn();
            if (isSignedIn) {
                const user = await puter.auth.getUser();
                set({
                    auth: {
                        user,
                        isAuthenticated: true,
                        signIn: get().auth.signIn,
                        signOut: get().auth.signOut,
                        refreshUser: get().auth.refreshUser,
                        checkAuthStatus: get().auth.checkAuthStatus,
                        getUser: () => user,
                    },
                    isLoading: false,
                });
                return true;
            }
            applyDemoAuth(demoUser, demoUser ? null : null);
            return false;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to check auth status";
            if (demoUser) {
                applyDemoAuth(demoUser, null);
                return true;
            }
            const fallbackUser: PuterUser = { uuid: "demo-user", username: "Demo User" };
            setDemoValue("user", fallbackUser);
            applyDemoAuth(fallbackUser, null);
            return true;
        }
    };

    const signIn = async (): Promise<void> => {
        const puter = getPuter();
        const demoUser: PuterUser = { uuid: "demo-user", username: "Demo User" };
        if (!puter) {
            setDemoValue("user", demoUser);
            applyDemoAuth(demoUser, null);
            return;
        }

        set({ isLoading: true, error: null });

        try {
            await puter.auth.signIn();
            await checkAuthStatus();
        } catch (err) {
            setDemoValue("user", demoUser);
            applyDemoAuth(demoUser, null);
        }
    };

    const signOut = async (): Promise<void> => {
        const puter = getPuter();
        if (!puter) {
            removeDemoValue("user");
            applyDemoAuth(null, null);
            return;
        }

        set({ isLoading: true, error: null });

        try {
            await puter.auth.signOut();
            set({
                auth: {
                    user: null,
                    isAuthenticated: false,
                    signIn: get().auth.signIn,
                    signOut: get().auth.signOut,
                    refreshUser: get().auth.refreshUser,
                    checkAuthStatus: get().auth.checkAuthStatus,
                    getUser: () => null,
                },
                isLoading: false,
            });
        } catch (err) {
            removeDemoValue("user");
            applyDemoAuth(null, null);
        }
    };

    const refreshUser = async (): Promise<void> => {
        const puter = getPuter();
        if (!puter) {
            const demoUser = getDemoValue<PuterUser | null>("user", null);
            applyDemoAuth(demoUser, null);
            return;
        }

        set({ isLoading: true, error: null });

        try {
            const user = await puter.auth.getUser();
            set({
                auth: {
                    user,
                    isAuthenticated: true,
                    signIn: get().auth.signIn,
                    signOut: get().auth.signOut,
                    refreshUser: get().auth.refreshUser,
                    checkAuthStatus: get().auth.checkAuthStatus,
                    getUser: () => user,
                },
                isLoading: false,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to refresh user";
            setError(msg);
        }
    };

    const init = (): void => {
        const puter = getPuter();
        if (puter) {
            set({ puterReady: true });
            checkAuthStatus();
            return;
        }

        const interval = setInterval(() => {
            if (getPuter()) {
                clearInterval(interval);
                set({ puterReady: true });
                checkAuthStatus();
            }
        }, 100);

        setTimeout(() => {
            clearInterval(interval);
            set({ puterReady: !getPuter() ? true : true });
            checkAuthStatus();
        }, 1000);
    };

    const write = async (path: string, data: string | File | Blob) => {
        const puter = getPuter();
        if (!puter) {
            const fileMap = getDemoValue<Record<string, any>>("files", {});
            const blob = data instanceof Blob ? data : new Blob([data], { type: "text/plain" });
            const fileName = path.split("/").pop() || "file.txt";
            const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(String(reader.result));
                reader.readAsDataURL(blob);
            });
            fileMap[path] = { id: path, uid: path, name: fileName, path, is_dir: false, parent_id: "", parent_uid: "", created: Date.now(), modified: Date.now(), accessed: Date.now(), size: blob.size, writable: true, dataUrl };
            setDemoValue("files", fileMap);
            const fileRecord = { id: path, uid: path, name: fileName, path, is_dir: false, parent_id: "", parent_uid: "", created: Date.now(), modified: Date.now(), accessed: Date.now(), size: blob.size, writable: true };
            return fileRecord as unknown as File;
        }
        return puter.fs.write(path, data);
    };

    const readDir = async (path: string) => {
        const puter = getPuter();
        if (!puter) {
            const fileMap = getDemoValue<Record<string, any>>("files", {});
            const items = Object.values(fileMap)
                .filter((item) => typeof item?.path === "string")
                .map((item) => ({
                    id: item.id,
                    uid: item.uid,
                    name: item.name,
                    path: item.path,
                    is_dir: item.is_dir,
                    parent_id: item.parent_id,
                    parent_uid: item.parent_uid,
                    created: item.created,
                    modified: item.modified,
                    accessed: item.accessed,
                    size: item.size,
                    writable: item.writable,
                })) as unknown as FSItem[];
            return items;
        }
        return puter.fs.readdir(path);
    };

    const readFile = async (path: string) => {
        const puter = getPuter();
        if (!puter) {
            const fileMap = getDemoValue<Record<string, any>>("files", {});
            const item = fileMap[path];
            if (!item?.dataUrl) return undefined;
            const response = await fetch(item.dataUrl);
            return response.blob();
        }
        return puter.fs.read(path);
    };

    const upload = async (files: File[] | Blob[]) => {
        const puter = getPuter();
        if (!puter) {
            const fileMap = getDemoValue<Record<string, any>>("files", {});
            const uploaded = files[0];
            if (!uploaded) return undefined;
            const fileName = uploaded instanceof File ? uploaded.name : `upload-${Date.now()}.bin`;
            const path = `demo/${Date.now()}-${fileName}`;
            const blob = uploaded instanceof Blob ? uploaded : new Blob([uploaded], { type: (uploaded as File).type || "application/octet-stream" });
            const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(String(reader.result));
                reader.readAsDataURL(blob);
            });
            fileMap[path] = { id: path, uid: path, name: fileName, path, is_dir: false, parent_id: "", parent_uid: "", created: Date.now(), modified: Date.now(), accessed: Date.now(), size: blob.size, writable: true, dataUrl };
            setDemoValue("files", fileMap);
            const fileRecord = { id: path, uid: path, name: fileName, path, is_dir: false, parent_id: "", parent_uid: "", created: Date.now(), modified: Date.now(), accessed: Date.now(), size: blob.size, writable: true };
            return fileRecord as unknown as FSItem;
        }
        return puter.fs.upload(files);
    };

    const deleteFile = async (path: string) => {
        const puter = getPuter();
        if (!puter) {
            const fileMap = getDemoValue<Record<string, any>>("files", {});
            delete fileMap[path];
            setDemoValue("files", fileMap);
            return;
        }
        return puter.fs.delete(path);
    };

    const chat = async (
        prompt: string | ChatMessage[],
        imageURL?: string | PuterChatOptions,
        testMode?: boolean,
        options?: PuterChatOptions
    ) => {
        const puter = getPuter();
        if (!puter) {
            throw new Error("Puter.js is unavailable. Reload the page and try AI analysis again.");
        }
        return puter.ai.chat(prompt, imageURL, testMode, options) as Promise<AIResponse | undefined>;
    };

    const feedback = async (path: string, message: string) => {
        const puter = getPuter();
        if (!puter) {
            throw new Error("Puter.js is unavailable. Reload the page and try AI analysis again.");
        }

        return puter.ai.chat(
            [
                {
                    role: "user",
                    content: [
                        {
                            type: "file",
                            puter_path: path,
                        },
                        {
                            type: "text",
                            text: message,
                        },
                    ],
                },
            ],
            {
                model: "gpt-4o-mini",
                max_tokens: 4000,
                temperature: 0.2,
                normalize: true,
            }
        ) as Promise<AIResponse | undefined>;
    };

    const img2txt = async (image: string | File | Blob, testMode?: boolean) => {
        const puter = getPuter();
        if (!puter) {
            throw new Error("Puter.js is unavailable. Reload the page and try AI text extraction again.");
        }
        return puter.ai.img2txt(image, testMode);
    };

    const getKV = async (key: string) => {
        const puter = getPuter();
        if (!puter) {
            return getDemoValue<Record<string, string>>("kv", {})[key] ?? null;
        }
        return puter.kv.get(key);
    };

    const setKV = async (key: string, value: string) => {
        const puter = getPuter();
        if (!puter) {
            const kvData = getDemoValue<Record<string, string>>("kv", {});
            kvData[key] = value;
            setDemoValue("kv", kvData);
            return true;
        }
        return puter.kv.set(key, value);
    };

    const deleteKV = async (key: string) => {
        const puter = getPuter();
        if (!puter) {
            const kvData = getDemoValue<Record<string, string>>("kv", {});
            delete kvData[key];
            setDemoValue("kv", kvData);
            return true;
        }
        return puter.kv.del(key);
    };

    const listKV = async (pattern: string, returnValues?: boolean) => {
        const puter = getPuter();
        if (!puter) {
            const kvData = getDemoValue<Record<string, string>>("kv", {});
            const items = Object.entries(kvData)
                .filter(([key]) => key.includes(pattern.replace(/\*$/, "")))
                .map(([key, value]) => (returnValues ? { key, value } : key));
            return items as unknown as string[] | KVItem[] | undefined;
        }
        if (returnValues === undefined) {
            returnValues = false;
        }
        return puter.kv.list(pattern, returnValues);
    };

    const flushKV = async () => {
        const puter = getPuter();
        if (!puter) {
            setDemoValue("kv", {});
            setDemoValue("files", {});
            return true;
        }
        return puter.kv.flush();
    };

    return {
        isLoading: true,
        error: null,
        puterReady: false,
        auth: {
            user: null,
            isAuthenticated: false,
            signIn,
            signOut,
            refreshUser,
            checkAuthStatus,
            getUser: () => get().auth.user,
        },
        fs: {
            write: (path: string, data: string | File | Blob) => write(path, data),
            read: (path: string) => readFile(path),
            readDir: (path: string) => readDir(path),
            upload: (files: File[] | Blob[]) => upload(files),
            delete: (path: string) => deleteFile(path),
        },
        ai: {
            chat: (
                prompt: string | ChatMessage[],
                imageURL?: string | PuterChatOptions,
                testMode?: boolean,
                options?: PuterChatOptions
            ) => chat(prompt, imageURL, testMode, options),
            feedback: (path: string, message: string) => feedback(path, message),
            img2txt: (image: string | File | Blob, testMode?: boolean) =>
                img2txt(image, testMode),
        },
        kv: {
            get: (key: string) => getKV(key),
            set: (key: string, value: string) => setKV(key, value),
            delete: (key: string) => deleteKV(key),
            list: (pattern: string, returnValues?: boolean) =>
                listKV(pattern, returnValues),
            flush: () => flushKV(),
        },
        init,
        clearError: () => set({ error: null }),
    };
});
