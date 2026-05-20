export default function CompareLoading() {
    return (
        <main className="min-h-screen overflow-x-clip bg-white pb-24 pt-24 sm:pb-32 sm:pt-28 md:pb-40 md:pt-36">
            <div className="container mx-auto max-w-7xl animate-pulse px-4 sm:px-6">
                <div className="mb-10 h-10 max-w-md rounded-lg bg-slate-100" />
                <div className="mb-6 h-4 w-64 rounded bg-slate-50" />
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50 p-6">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="mx-auto h-24 w-full max-w-[140px] rounded-xl bg-slate-100"
                            />
                        ))}
                    </div>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="grid grid-cols-4 gap-4 border-b border-slate-50 p-4"
                        >
                            <div className="h-4 w-20 rounded bg-slate-100" />
                            <div className="col-span-3 h-4 rounded bg-slate-50" />
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}
