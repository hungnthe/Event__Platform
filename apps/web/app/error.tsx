'use client';
export default function GlobalError({ reset }: Readonly<{ error: Error; reset: () => void }>) { return <main className="mx-auto max-w-xl p-10"><h1 className="text-2xl font-bold">Không thể tải trang</h1><p className="mt-3">Đã có lỗi không mong muốn. Bạn có thể thử lại.</p><button className="mt-6 rounded bg-blue-700 px-4 py-2 text-white" onClick={reset}>Thử lại</button></main>; }
