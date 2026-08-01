import { useLocation } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ComingSoonPage() {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
          <Construction className="w-12 h-12 text-yellow-600" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">{pageName}</h1>
          <p className="text-lg text-slate-600">Coming Soon</p>
          <p className="text-sm text-slate-500">
            This feature is currently under development. Check back later!
          </p>
        </div>

        <Link 
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-dswd-lightBlue text-white font-semibold rounded-lg hover:bg-dswd-blue transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
