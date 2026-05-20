export default function RegistryProductLoading() {
    return (
        <main className="min-h-screen overflow-x-clip bg-white pb-12 pt-28 font-sans sm:pb-20 sm:pt-32 md:pt-44">
            <div className="container mx-auto max-w-7xl animate-pulse px-4 sm:px-6">
                <div className="mb-6 h-3 w-32 rounded bg-slate-100" />
                <div className="mb-4 h-12 max-w-3xl rounded-lg bg-slate-100 sm:h-16" />
                <div className="mb-10 h-4 max-w-xl rounded bg-slate-50" />

                <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
                    <div className="space-y-8 lg:col-span-8">
                        <div className="aspect-video rounded-2xl bg-slate-50" />
                        <div className="h-56 rounded-2xl bg-slate-50" />
                        <div className="h-40 rounded-2xl bg-slate-50" />
                    </div>
                    <aside className="space-y-6 lg:col-span-4">
                        <div className="h-48 rounded-2xl border border-slate-100 bg-slate-50/80" />
                        <div className="h-64 rounded-2xl border border-slate-100 bg-slate-50/80" />
                    </aside>
                </div>
            </div>
        </main>
    )
}
