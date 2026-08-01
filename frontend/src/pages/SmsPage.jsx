import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import { smsApi } from '../services/api';

export default function SmsPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await smsApi.list();
        setMessages(response.data.data || []);
      } catch (err) {
        setError(err.message || 'Unable to load SMS notifications');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const columns = [
    { header: 'Message', accessor: 'message' },
    { header: 'Status', accessor: 'status' },
    { header: 'Sent At', accessor: 'sent_at' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">SMS Notifications</h1>
        <p className="mt-2 text-sm text-slate-600">Review notification logs and delivery status for beneficiaries.</p>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <Card>
        {loading ? <p className="text-sm text-slate-500">Loading SMS records...</p> : <Table columns={columns} data={messages} />}
      </Card>
    </div>
  );
}
