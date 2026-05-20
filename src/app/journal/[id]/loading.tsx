export default function JournalEntryLoading() {
    return (
        <main className="min-h-screen bg-white pt-28 pb-24 font-sans md:pt-32">
            <div className="container mx-auto max-w-7xl animate-pulse px-4 sm:px-6">
                <div className="mb-10 flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-6">
                    <div className="h-8 w-40 rounded bg-slate-100" />
                    <div className="h-9 w-36 rounded-xl bg-slate-100" />
                </div>

                <div className="grid gap-16 lg:grid-cols-12">
                    <aside className="space-y-6 lg:col-span-4">
                        <div className="h-6 w-32 rounded bg-slate-100" />
                        <div className="h-12 rounded-lg bg-slate-50" />
                        <div className="h-40 rounded-2xl bg-slate-50" />
                    </aside>
                    <div className="space-y-8 lg:col-span-8">
                        <div className="h-10 max-w-2xl rounded-lg bg-slate-100" />
                        <div className="h-4 w-full rounded bg-slate-50" />
                        <div className="h-4 w-5/6 rounded bg-slate-50" />
                        <div className="h-48 rounded-2xl bg-slate-50" />
                        <div className="h-32 rounded-2xl bg-slate-50" />
                    </div>
                </div>
            </div>
        </main>
    )
}
