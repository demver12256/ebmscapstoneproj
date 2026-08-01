import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import { attendanceApi } from '../services/api';

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await attendanceApi.list();
        setRecords(response.data.data || []);
      } catch (err) {
        setError(err.message || 'Unable to load attendance logs');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const columns = [
    { header: 'Event', accessor: 'event_name' },
    { header: 'RFID', accessor: 'RFID_number' },
    { header: 'Date', accessor: 'attendance_date' },
    { header: 'Time', accessor: 'time_in' },
    { header: 'Remarks', accessor: 'remarks' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">RFID Attendance</h1>
        <p className="mt-2 text-sm text-slate-600">Monitor attendance logs for aid distribution events and programs.</p>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <Card>
        {loading ? <p className="text-sm text-slate-500">Loading attendance records...</p> : <Table columns={columns} data={records} />}
      </Card>
    </div>
  );
}
