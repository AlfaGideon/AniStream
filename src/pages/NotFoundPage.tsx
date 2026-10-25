import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="grid place-items-center py-32 text-center">
      <div>
        <div className="font-display mb-3 text-6xl font-bold text-accent">404</div>
        <p className="text-lg font-semibold">Такой страницы нет в этой вселенной</p>
        <p className="mt-1 text-sm text-mute">Возможно, она ушла в другой исекай</p>
        <Link to="/" className="mt-6 inline-block rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110">
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
}
