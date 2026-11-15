"use client";
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="kicker">Сбой</div>
      <h1>Данные сейчас недоступны</h1>
      <p className="dek">Чаще всего это значит, что база данных не подключена или не отвечает. После подключения базы страница заработает без изменений в коде.</p>
      <button className="btn" onClick={reset}>Повторить</button>
      {error.digest && <p className="fine">Код ошибки: {error.digest}</p>}
    </div>
  );
}
