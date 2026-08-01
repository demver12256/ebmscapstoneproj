import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[75vh] place-items-center px-4 py-12 text-slate-900">
      <div className="max-w-xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="mt-4 text-lg text-slate-600">Page not found. The requested page is not available.</p>
        <Link to="/">
          <Button className="mt-6">Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
