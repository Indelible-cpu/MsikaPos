import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalExpense, type LocalProduct } from '../db/posDB';
import {
  Plus, Search, Trash2, ArrowDownCircle, FileText, MessageSquare, Pencil,
  Users, DollarSign, FileBarChart2, CheckCircle2, XCircle,
  Printer, BadgeDollarSign, Settings2, AlertCircle, QrCode, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { Receipt } from '../components/Receipt';
import html2canvas from 'html2canvas';
import api from '../api/client';

type ExpenseReceiptProps = React.ComponentProps<typeof Receipt>;

// ─── PAYROLL TYPES ─────────────────────────────────────────────────────────
interface Employee {
  id: number; username: string; fullname: string; phone: string;
  role: { name: string };
  salaryConfig: { basicSalary: number; allowances: number; deductions: number; currency: string; notes?: string } | null;
}
interface Advance {
  id: number; userId: number; amount: number; reason?: string; status: string;
  requestedAt: string; approvedAt?: string; repaidAt?: string;
  user: { id: number; username: string; fullname: string };
  approver?: { id: number; fullname: string };
}
interface Payslip {
  id: number; userId: number; month: number; year: number;
  basicSalary: number; allowances: number; deductions: number;
  advanceDeduct: number; netPay: number; status: string; generatedAt: string;
  user: { id: number; username: string; fullname: string; role: { name: string } };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── PAYROLL TAB COMPONENT ─────────────────────────────────────────────────
const PayrollTab: React.FC = () => {
  const [subTab, setSubTab] = useState<'salaries' | 'advances' | 'payslips'>('salaries');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null);

  // Salary modal
  const [salaryModal, setSalaryModal] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null });
  const [salaryForm, setSalaryForm] = useState({ basicSalary: '', allowances: '', deductions: '', notes: '' });

  // Advance modal
  const [advanceModal, setAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ userId: '', amount: '', reason: '' });

  // Payslip filter
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  // Company name for payslip
  const [companyName, setCompanyName] = useState('MsikaPos');

  useEffect(() => {
    api.get('/public/settings').then(r => { if (r.data?.data?.name) setCompanyName(r.data.data.name); }).catch(() => {});
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/payroll/employees'); setEmployees(r.data.data); }
    catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  }, []);

  const loadAdvances = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/payroll/advances'); setAdvances(r.data.data); }
    catch { toast.error('Failed to load advances'); }
    finally { setLoading(false); }
  }, []);

  const loadPayslips = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/payroll/payslips?month=${filterMonth}&year=${filterYear}`); setPayslips(r.data.data); }
    catch { toast.error('Failed to load payslips'); }
    finally { setLoading(false); }
  }, [filterMonth, filterYear]);

  useEffect(() => { if (subTab === 'salaries') loadEmployees(); }, [subTab, loadEmployees]);
  useEffect(() => { if (subTab === 'advances') loadAdvances(); }, [subTab, loadAdvances]);
  useEffect(() => { if (subTab === 'payslips') loadPayslips(); }, [subTab, loadPayslips]);

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryModal.employee) return;
    try {
      await api.post('/payroll/salary-config', {
        userId: salaryModal.employee.id,
        basicSalary: Number(salaryForm.basicSalary),
        allowances: Number(salaryForm.allowances) || 0,
        deductions: Number(salaryForm.deductions) || 0,
        notes: salaryForm.notes
      });
      toast.success('Salary configured!');
      setSalaryModal({ open: false, employee: null });
      loadEmployees();
    } catch { toast.error('Failed to save salary config'); }
  };

  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payroll/advances', { userId: Number(advanceForm.userId), amount: Number(advanceForm.amount), reason: advanceForm.reason });
      toast.success('Advance recorded!');
      setAdvanceModal(false);
      setAdvanceForm({ userId: '', amount: '', reason: '' });
      loadAdvances();
    } catch { toast.error('Failed to record advance'); }
  };

  const handleAdvanceAction = async (id: number, status: string) => {
    try {
      await api.put(`/payroll/advances/${id}`, { status });
      toast.success(`Advance ${status.toLowerCase()}`);
      loadAdvances();
    } catch { toast.error('Action failed'); }
  };

  const handleGeneratePayslip = async (userId: number) => {
    const toastId = toast.loading('Generating payslip...');
    try {
      await api.post('/payroll/payslips/generate', { userId, month: filterMonth, year: filterYear });
      toast.success('Payslip generated!', { id: toastId });
      loadPayslips();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to generate payslip', { id: toastId });
    }
  };

  const handleGenerateAll = async () => {
    const configured = employees.filter(emp => emp.salaryConfig);
    if (configured.length === 0) { toast.error('No employees have salary configured'); return; }
    const toastId = toast.loading(`Generating ${configured.length} payslips...`);
    try {
      await Promise.all(configured.map(emp => api.post('/payroll/payslips/generate', { userId: emp.id, month: filterMonth, year: filterYear })));
      toast.success(`${configured.length} payslips generated!`, { id: toastId });
      loadPayslips();
    } catch { toast.error('Some payslips failed to generate', { id: toastId }); }
  };

  const printPayslip = (slip: Payslip) => { setViewingPayslip(slip); };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-amber-500/10 text-amber-500',
      APPROVED: 'bg-emerald-500/10 text-emerald-500',
      REJECTED: 'bg-rose-500/10 text-rose-500',
      REPAID: 'bg-primary/10 text-primary',
    };
    return <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase ${map[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
  };

  return (
    <div className="flex flex-col">
      {/* Sub-Tab Bar */}
      <div className="flex gap-0 border-b border-border/50 px-4 md:px-12">
        {([
          { key: 'salaries', label: 'Salaries', icon: DollarSign },
          { key: 'advances', label: 'Advances', icon: BadgeDollarSign },
          { key: 'payslips', label: 'Payslips', icon: FileBarChart2 },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setSubTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-black tracking-widest uppercase border-b-2 transition-all ${
              subTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── SALARIES TAB ── */}
      {subTab === 'salaries' && (
        <div className="px-4 md:px-12 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black tracking-tight text-foreground">Employee Salaries</h2>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Configure basic salary, allowances and deductions per employee</p>
            </div>
          </div>
          {loading ? (
            <div className="py-20 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <div className="divide-y divide-border/30 rounded-2xl border border-border/50 overflow-hidden">
              {employees.map(emp => {
                const cfg = emp.salaryConfig;
                const net = cfg ? Number(cfg.basicSalary) + Number(cfg.allowances) - Number(cfg.deductions) : null;
                return (
                  <div key={emp.id} className="flex items-center justify-between p-4 md:p-5 hover:bg-muted/5 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                        {(emp.fullname || emp.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-sm text-foreground truncate">{emp.fullname || emp.username}</div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{emp.role.name.replace('_',' ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {cfg ? (
                        <div className="text-right hidden sm:block">
                          <div className="text-sm font-black text-emerald-500">MK {net?.toLocaleString()}</div>
                          <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Net Pay</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase tracking-wide hidden sm:inline">Not configured</span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setSalaryForm({
                            basicSalary: cfg ? String(cfg.basicSalary) : '',
                            allowances: cfg ? String(cfg.allowances) : '0',
                            deductions: cfg ? String(cfg.deductions) : '0',
                            notes: cfg?.notes || ''
                          });
                          setSalaryModal({ open: true, employee: emp });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-[9px] font-black tracking-widest uppercase transition-colors"
                      >
                        <Settings2 className="w-3.5 h-3.5" /> {cfg ? 'Edit' : 'Configure'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {employees.length === 0 && (
                <div className="py-20 text-center text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">No employees found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ADVANCES TAB ── */}
      {subTab === 'advances' && (
        <div className="px-4 md:px-12 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black tracking-tight text-foreground">Salary Advances</h2>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Track advance payment requests from employees</p>
            </div>
            <button onClick={() => { setAdvanceForm({ userId: '', amount: '', reason: '' }); setAdvanceModal(true); }}
              className="flex items-center gap-1.5 btn-primary px-4 py-2.5 text-[9px] font-black tracking-widest uppercase rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-3.5 h-3.5" /> Record Advance
            </button>
          </div>
          {loading ? (
            <div className="py-20 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <div className="divide-y divide-border/30 rounded-2xl border border-border/50 overflow-hidden">
              {advances.map(adv => (
                <div key={adv.id} className="flex items-center justify-between p-4 md:p-5 hover:bg-muted/5 transition-colors gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <BadgeDollarSign className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-sm text-foreground">{adv.user.fullname || adv.user.username}</div>
                      <div className="text-[9px] font-semibold text-muted-foreground truncate">{adv.reason || 'No reason given'}</div>
                      <div className="text-[8px] text-muted-foreground/50 font-bold">{new Date(adv.requestedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-black text-foreground">MK {Number(adv.amount).toLocaleString()}</div>
                    </div>
                    {statusBadge(adv.status)}
                    {adv.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleAdvanceAction(adv.id, 'APPROVED')}
                          className="p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-colors" title="Approve">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAdvanceAction(adv.id, 'REJECTED')}
                          className="p-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-lg transition-colors" title="Reject">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {adv.status === 'APPROVED' && (
                      <button onClick={() => handleAdvanceAction(adv.id, 'REPAID')}
                        className="px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-[9px] font-black uppercase tracking-wide transition-colors">
                        Mark Repaid
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {advances.length === 0 && (
                <div className="py-20 text-center text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">No advances recorded</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PAYSLIPS TAB ── */}
      {subTab === 'payslips' && (
        <div className="px-4 md:px-12 py-6 space-y-4">
          <div className="flex items-center flex-wrap gap-3 justify-between">
            <div>
              <h2 className="text-sm font-black tracking-tight text-foreground">Payslips</h2>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Generate and view monthly payslips</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
                className="input-field py-2 px-3 text-[10px] font-black h-9">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
                className="input-field py-2 px-3 text-[10px] font-black h-9">
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={handleGenerateAll}
                className="flex items-center gap-1.5 btn-primary px-4 py-2 text-[9px] font-black tracking-widest uppercase rounded-xl shadow-lg shadow-primary/20 h-9">
                <FileBarChart2 className="w-3.5 h-3.5" /> Generate All
              </button>
            </div>
          </div>
          {loading ? (
            <div className="py-20 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <div className="divide-y divide-border/30 rounded-2xl border border-border/50 overflow-hidden">
              {employees.map(emp => {
                const slip = payslips.find(p => p.userId === emp.id);
                return (
                  <div key={emp.id} className="flex items-center justify-between p-4 md:p-5 hover:bg-muted/5 transition-colors gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                        {(emp.fullname || emp.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-black text-sm text-foreground">{emp.fullname || emp.username}</div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{emp.role.name.replace('_',' ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {slip ? (
                        <>
                          <div className="text-right hidden sm:block">
                            <div className="text-sm font-black text-emerald-500">MK {Number(slip.netPay).toLocaleString()}</div>
                            <div className="text-[8px] text-muted-foreground/50 font-bold uppercase">Net Pay</div>
                          </div>
                          <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase bg-emerald-500/10 text-emerald-500">{slip.status}</span>
                          <button onClick={() => printPayslip(slip)}
                            className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors" title="View & Print">
                            <Printer className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {emp.salaryConfig ? (
                            <button onClick={() => handleGeneratePayslip(emp.id)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-[9px] font-black tracking-widest uppercase transition-colors">
                              <FileBarChart2 className="w-3.5 h-3.5" /> Generate
                            </button>
                          ) : (
                            <span className="text-[9px] font-black text-amber-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/>No salary set</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {employees.length === 0 && (
                <div className="py-20 text-center text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">No employees found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SALARY CONFIG MODAL ── */}
      <Modal isOpen={salaryModal.open} onClose={() => setSalaryModal({ open: false, employee: null })}
        title={`Configure Salary — ${salaryModal.employee?.fullname || salaryModal.employee?.username}`} maxWidth="max-w-md">
        <form onSubmit={handleSaveSalary} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Basic Salary (MWK)</label>
            <input required type="number" min="0" className="input-field w-full py-4 px-6 text-lg font-black"
              placeholder="0.00" value={salaryForm.basicSalary}
              onChange={e => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Allowances (MWK)</label>
              <input type="number" min="0" className="input-field w-full py-4 px-4 font-black"
                placeholder="0.00" value={salaryForm.allowances}
                onChange={e => setSalaryForm({ ...salaryForm, allowances: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Deductions (MWK)</label>
              <input type="number" min="0" className="input-field w-full py-4 px-4 font-black"
                placeholder="0.00" value={salaryForm.deductions}
                onChange={e => setSalaryForm({ ...salaryForm, deductions: e.target.value })} />
            </div>
          </div>
          {(Number(salaryForm.basicSalary) || 0) > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Net Pay Preview</span>
              <span className="text-xl font-black text-emerald-500">MK {(
                (Number(salaryForm.basicSalary) || 0) +
                (Number(salaryForm.allowances) || 0) -
                (Number(salaryForm.deductions) || 0)
              ).toLocaleString()}</span>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Notes (optional)</label>
            <input type="text" className="input-field w-full py-3 px-6 text-sm font-bold"
              placeholder="e.g. Reviewed Jan 2025" value={salaryForm.notes}
              onChange={e => setSalaryForm({ ...salaryForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => setSalaryModal({ open: false, employee: null })}
              className="flex-1 py-4 bg-muted/20 border border-border/50 rounded-[1.5rem] text-[10px] font-black tracking-widest uppercase">Cancel</button>
            <button type="submit" className="flex-1 btn-primary py-4 text-[10px] font-black tracking-widest uppercase rounded-[1.5rem]">Save Config</button>
          </div>
        </form>
      </Modal>

      {/* ── ADVANCE REQUEST MODAL ── */}
      <Modal isOpen={advanceModal} onClose={() => setAdvanceModal(false)} title="Record Advance Payment" maxWidth="max-w-md">
        <form onSubmit={handleSaveAdvance} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Employee</label>
            <select required className="input-field w-full py-4 px-6 font-black appearance-none"
              value={advanceForm.userId} onChange={e => setAdvanceForm({ ...advanceForm, userId: e.target.value })}>
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullname || emp.username}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Amount (MWK)</label>
            <input required type="number" min="1" className="input-field w-full py-5 px-6 text-2xl font-black"
              placeholder="0.00" value={advanceForm.amount}
              onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Reason (optional)</label>
            <input type="text" className="input-field w-full py-4 px-6 text-sm font-bold"
              placeholder="e.g. Medical emergency" value={advanceForm.reason}
              onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })} />
          </div>
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => setAdvanceModal(false)}
              className="flex-1 py-4 bg-muted/20 border border-border/50 rounded-[1.5rem] text-[10px] font-black tracking-widest uppercase">Cancel</button>
            <button type="submit" className="flex-1 btn-primary py-4 text-[10px] font-black tracking-widest uppercase rounded-[1.5rem]">Record Advance</button>
          </div>
        </form>
      </Modal>

      {/* ── PAYSLIP VIEW & PRINT MODAL ── */}
      <Modal isOpen={!!viewingPayslip} onClose={() => setViewingPayslip(null)} title="Payslip" maxWidth="max-w-lg">
        {viewingPayslip && (
          <div className="p-6 flex flex-col items-center gap-6">
            {/* Professional Payslip Card */}
            <div id="payslip-card" className="w-full bg-white text-slate-800 rounded-xl p-8 md:p-10 shadow-2xl border border-slate-200 font-sans relative overflow-hidden">
              {/* Secure Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <ShieldCheck className="w-96 h-96 text-slate-900" />
              </div>
              
              <div className="relative z-10">
                {/* Header & Logo Area */}
                <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-100">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xl shadow-lg">
                      {companyName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{companyName}</h1>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Official Payslip Document</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Pay Period</p>
                    <p className="text-lg font-black text-slate-900 leading-none">{MONTHS[viewingPayslip.month - 1]} {viewingPayslip.year}</p>
                    <p className="text-[9px] text-slate-500 font-semibold mt-2">Ref: PAY-{viewingPayslip.year}{String(viewingPayslip.month).padStart(2, '0')}-{String(viewingPayslip.userId).padStart(4, '0')}</p>
                  </div>
                </div>

                {/* Employee Info Grid */}
                <div className="grid grid-cols-2 gap-6 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Employee Name</p>
                    <p className="text-base font-black text-slate-900">{viewingPayslip.user.fullname || viewingPayslip.user.username}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Designation / Role</p>
                    <p className="text-sm font-bold text-slate-700">{viewingPayslip.user.role.name.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Payment Status</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" /> Processed
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Issue Date</p>
                    <p className="text-sm font-bold text-slate-700">{new Date(viewingPayslip.generatedAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Financial Details Table */}
                <div className="mb-8">
                  <div className="grid grid-cols-2 gap-4 pb-2 border-b-2 border-slate-800 mb-3">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Earnings</div>
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest text-right">Amount (MK)</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-600">Basic Salary</span>
                      <span className="text-sm font-black text-slate-900">{Number(viewingPayslip.basicSalary).toLocaleString()}</span>
                    </div>
                    {Number(viewingPayslip.allowances) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-600">Allowances & Bonuses</span>
                        <span className="text-sm font-black text-emerald-600">+{Number(viewingPayslip.allowances).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pb-2 border-b-2 border-slate-800 mt-6 mb-3">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Deductions</div>
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest text-right">Amount (MK)</div>
                  </div>
                  <div className="space-y-3">
                    {Number(viewingPayslip.deductions) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-600">Standard Deductions</span>
                        <span className="text-sm font-black text-rose-600">-{Number(viewingPayslip.deductions).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(viewingPayslip.advanceDeduct) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-600">Salary Advance Repayment</span>
                        <span className="text-sm font-black text-rose-600">-{Number(viewingPayslip.advanceDeduct).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(viewingPayslip.deductions) === 0 && Number(viewingPayslip.advanceDeduct) === 0 && (
                      <div className="text-sm font-bold text-slate-400 italic">No deductions for this period.</div>
                    )}
                  </div>
                </div>

                {/* Net Pay Summary */}
                <div className="bg-slate-900 rounded-xl p-6 flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Payable Amount</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Transferred to employee account</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-400 mr-1">MK</span>
                    <span className="text-3xl font-black text-white tracking-tight">{Number(viewingPayslip.netPay).toLocaleString()}</span>
                  </div>
                </div>

                {/* Secure Footer Section */}
                <div className="mt-10 pt-6 border-t border-slate-200 flex items-end justify-between">
                  <div className="flex flex-col items-center gap-1">
                    <div className="border-b border-slate-300 w-32 pb-6"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Signatory</span>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex items-center gap-2 text-slate-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[8px] font-black uppercase tracking-widest">Verified Document</span>
                    </div>
                    <QrCode className="w-12 h-12 text-slate-800" />
                    <span className="text-[7px] text-slate-400 font-bold mt-1">Scan for verification</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button
                onClick={async () => {
                  const el = document.getElementById('payslip-card');
                  if (!el) return;
                  toast.loading('Preparing payslip...', { id: 'payslip-share' });
                  try {
                    const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
                    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                    if (blob) {
                      const file = new File([blob], `payslip-${viewingPayslip.user.username}-${viewingPayslip.month}-${viewingPayslip.year}.png`, { type: 'image/png' });
                      if (navigator.share) {
                        await navigator.share({ files: [file], title: 'Payslip', text: `Payslip for ${MONTHS[viewingPayslip.month - 1]} ${viewingPayslip.year}` });
                        toast.success('Shared!', { id: 'payslip-share' });
                      } else {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = file.name; a.click();
                        toast.success('Downloaded!', { id: 'payslip-share' });
                      }
                    }
                  } catch { toast.error('Failed to share', { id: 'payslip-share' }); }
                }}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 uppercase"
              >
                <MessageSquare className="w-4 h-4" /> Share / Download
              </button>
              <button type="button" onClick={() => setViewingPayslip(null)}
                className="flex-1 py-4 btn-primary font-black text-[10px] tracking-widest uppercase rounded-2xl">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ─── MAIN EXPENSES PAGE ────────────────────────────────────────────────────
const ExpensesPage: React.FC = () => {
  const { isReadOnly } = useFeatureAccess();
  const readOnly = isReadOnly('FINANCE');
  const [activeTab, setActiveTab] = useState<'expenses' | 'payroll'>('expenses');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<LocalExpense | null>(null);

  const [formData, setFormData] = useState<{
    category: string; amount: number | ''; description: string; date: string; paymentMethod: string;
  }>({ category: 'Utilities', amount: 0, description: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash' });

  const [expenseReceipt, setExpenseReceipt] = useState<ExpenseReceiptProps | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const expenses = useLiveQuery(
    () => db.expenses.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase())).reverse().toArray(),
    [searchTerm]
  );

  const totalSpent = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

  const groupedExpenses = useMemo(() => {
    if (!expenses) return {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = today - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = today - (30 * 24 * 60 * 60 * 1000);
    const groups: Record<string, LocalExpense[]> = { 'Today': [], 'This week': [], 'This month': [], 'Older': [] };
    expenses.forEach(exp => {
      const expDate = new Date(exp.date).getTime();
      if (expDate >= today) groups['Today'].push(exp);
      else if (expDate >= oneWeekAgo) groups['This week'].push(exp);
      else if (expDate >= oneMonthAgo) groups['This month'].push(exp);
      else groups['Older'].push(exp);
    });
    return groups;
  }, [expenses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await db.expenses.update(editingExpense.id, { ...formData, amount: Number(formData.amount) || 0 });
        toast.success('Expense updated');
      } else {
        const expenseId = crypto.randomUUID();
        const expenseData = { ...formData, amount: Number(formData.amount) || 0, id: expenseId, createdAt: new Date().toISOString(), synced: 0 };
        await db.expenses.add(expenseData);
        setExpenseReceipt({
          items: [{ product: { name: `Expense: ${formData.description}`, sellPrice: Number(formData.amount) || 0 } as unknown as LocalProduct, quantity: 1 }],
          total: Number(formData.amount) || 0, subtotal: Number(formData.amount) || 0, tax: 0, discount: 0,
          invoiceNo: `EXP-${expenseId.substring(0, 6).toUpperCase()}`, date: formData.date,
          mode: formData.paymentMethod, paid: Number(formData.amount) || 0, change: 0
        });
        toast.success('Expense recorded');
      }
      setIsModalOpen(false); setEditingExpense(null); resetForm();
    } catch { toast.error('Failed to save expense'); }
  };

  const handleDelete = (id: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-black tracking-wide text-foreground uppercase">Delete this expense record?</span>
        <div className="flex gap-2 justify-end mt-1">
          <button className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-muted/50 text-muted-foreground hover:bg-muted/80 transition-colors" onClick={() => toast.dismiss(t.id)}>Cancel</button>
          <button className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
            onClick={async () => {
              toast.dismiss(t.id);
              try { if (!navigator.onLine) { toast.error('You must be online to delete an expense.'); return; } await api.delete(`/expenses/${id}`); await db.expenses.delete(id); toast.success('Record deleted'); }
              catch { toast.error('Failed to delete expense online. Try again.'); }
            }}>Delete</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleBulkDelete = () => {
    if (selectedExpenseIds.size === 0) return;
    toast((t) => (
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-black tracking-wide text-foreground uppercase">Delete {selectedExpenseIds.size} selected expenses?</span>
        <div className="flex gap-2 justify-end mt-1">
          <button className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-muted/50 text-muted-foreground hover:bg-muted/80 transition-colors" onClick={() => toast.dismiss(t.id)}>Cancel</button>
          <button className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                if (!navigator.onLine) { toast.error('You must be online to bulk delete expenses.'); return; }
                await Promise.all(Array.from(selectedExpenseIds).map(id => api.delete(`/expenses/${id}`)));
                await db.expenses.bulkDelete(Array.from(selectedExpenseIds));
                setSelectedExpenseIds(new Set()); toast.success(`${selectedExpenseIds.size} records deleted`);
              } catch { toast.error('Failed to bulk delete online. Try again.'); }
            }}>Delete</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const resetForm = () => setFormData({ category: 'Utilities', amount: 0, description: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash' });
  const categories = ['Utilities', 'Stock purchase', 'Salaries', 'Rent', 'Maintenance', 'Marketing', 'Other'];

  return (
    <div className="flex flex-col transition-all relative">

      {/* ── Main Tab Bar ── */}
      <div className="bg-background border-b border-border/50 px-4 md:px-12 sticky top-0 z-40">
        <div className="flex gap-0">
          {([
            { key: 'expenses', label: 'Expenses', icon: ArrowDownCircle },
            { key: 'payroll', label: 'Payroll', icon: Users },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-4 text-[10px] font-black tracking-widest uppercase border-b-2 transition-all ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Expenses search/actions bar — only show on expenses tab */}
        {activeTab === 'expenses' && (
          <div className="flex flex-row flex-nowrap items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-3">
            <div className="relative flex-[2] min-w-[150px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input type="text" placeholder="Search expenses..." className="input-field w-full pl-11 text-[11px] h-10 font-bold shadow-inner"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {!readOnly && expenses && expenses.length > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0 px-2 group">
                <input type="checkbox" className="w-4 h-4 rounded-md border-border/50 text-primary focus:ring-primary bg-surface-card cursor-pointer"
                  checked={selectedExpenseIds.size === expenses.length}
                  onChange={(e) => { if (e.target.checked && expenses) { setSelectedExpenseIds(new Set(expenses.map(exp => exp.id))); } else { setSelectedExpenseIds(new Set()); } }} />
                <span className="text-[11px] font-black text-muted-foreground group-hover:text-primary transition-colors uppercase tracking-wider">Select All</span>
              </label>
            )}
            {selectedExpenseIds.size > 0 && !readOnly && (
              <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-[11px] font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 shadow-lg shadow-rose-500/20">
                <Trash2 className="w-3.5 h-3.5" /> Delete {selectedExpenseIds.size}
              </button>
            )}
            {!readOnly && (
              <button onClick={() => { resetForm(); setEditingExpense(null); setIsModalOpen(true); }}
                className="flex items-center gap-1.5 text-[11px] font-black text-primary hover:underline whitespace-nowrap shrink-0 px-2">
                <Plus className="w-3.5 h-3.5" /> Add expense
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── EXPENSES TAB CONTENT ── */}
      {activeTab === 'expenses' && (
        <div className="w-full px-4 md:px-12 py-6 space-y-6">
          <div className="glass-panel rounded-2xl border border-border/50 p-4 flex items-center justify-between shadow-lg max-w-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center shrink-0">
                <ArrowDownCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">Total outflow</div>
                <div className="text-xl font-black text-foreground tracking-tighter">MK {totalSpent.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pb-20">
            {Object.entries(groupedExpenses).map(([groupName, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[9px] font-black tracking-[0.2em] text-primary uppercase whitespace-nowrap">{groupName}</h3>
                    <div className="h-px bg-primary/10 flex-1" />
                  </div>
                  <div className="divide-y divide-border/20 border-b border-border/10">
                    {items.map(exp => (
                      <div key={exp.id} className="py-3 px-1 flex justify-between items-center group hover:bg-muted/5 transition-all gap-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {!readOnly && (
                            <input type="checkbox" checked={selectedExpenseIds.has(exp.id)}
                              onChange={(e) => { const next = new Set(selectedExpenseIds); if (e.target.checked) next.add(exp.id); else next.delete(exp.id); setSelectedExpenseIds(next); }}
                              className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0" />
                          )}
                          <div className="hidden sm:flex w-9 h-9 bg-muted/10 text-muted-foreground/60 rounded-xl items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs md:text-sm tracking-tight text-foreground truncate lowercase first-letter:uppercase">{exp.description || 'No description'}</div>
                            <div className="text-[9px] md:text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span>{exp.category}</span>
                              <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                              <span>{exp.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:gap-6 shrink-0">
                          <div className="text-right flex flex-col justify-center">
                            <div className="text-sm md:text-base font-black text-destructive tracking-tight">MK {exp.amount.toLocaleString()}</div>
                            <div className="text-[8px] md:text-[9px] text-muted-foreground/50 font-bold uppercase tracking-wider">{exp.paymentMethod}</div>
                          </div>
                          {!readOnly && (
                            <div className="flex items-center gap-0.5">
                              <button title="Edit expense" onClick={() => { setEditingExpense(exp); setFormData({ category: exp.category, amount: exp.amount, description: exp.description, date: exp.date, paymentMethod: exp.paymentMethod }); setIsModalOpen(true); }}
                                className="p-1.5 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button title="Delete expense" onClick={() => handleDelete(exp.id)}
                                className="p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {expenses?.length === 0 && (
              <div className="py-32 text-center">
                <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-muted-foreground/20" />
                </div>
                <p className="text-[10px] font-black tracking-widest text-muted-foreground/30 uppercase">No records found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PAYROLL TAB CONTENT ── */}
      {activeTab === 'payroll' && <PayrollTab />}

      {/* ── EXPENSE MODALS ── */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingExpense(null); resetForm(); }}
        title={editingExpense ? 'Edit expense' : 'New expense'} maxWidth="max-w-md">
        <form onSubmit={handleSave} className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-full">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Description</label>
              <input required type="text" className="input-field w-full py-4 px-6 text-sm font-black" placeholder="e.g. Electricity bill" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Category</label>
              <select title="Expense category" className="input-field w-full py-4 px-6 text-sm font-black appearance-none bg-background" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Date</label>
              <input title="Expense date" type="date" className="input-field w-full py-4 px-6 text-sm font-black" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-full">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Payment method</label>
              <select title="Payment method" className="input-field w-full py-4 px-6 text-sm font-black appearance-none bg-background" value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}>
                {['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque', 'Other'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Amount (MK)</label>
            <div className="relative group">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-destructive opacity-20 group-focus-within:opacity-100 transition-opacity">MK</span>
              <input title="Expense amount" required type="number" className="input-field w-full py-8 pl-20 pr-8 text-4xl font-black text-destructive text-right"
                placeholder="0.00" value={formData.amount === '' ? '' : formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value === '' ? '' : parseFloat(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
          </div>
          <div className="flex gap-4 pt-6">
            <button type="button" onClick={() => { setIsModalOpen(false); setEditingExpense(null); resetForm(); }} className="flex-1 py-5 bg-muted/20 border border-border/50 rounded-[1.5rem] text-[10px] font-black tracking-widest uppercase transition-all hover:bg-muted/30">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-5 text-[10px] font-black tracking-widest bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/20 uppercase transition-all">Save expense</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!expenseReceipt} onClose={() => setExpenseReceipt(null)} title="Expense voucher" maxWidth="max-w-md">
        {expenseReceipt && (
          <div className="p-10 flex flex-col items-center gap-8">
            <div className="bg-white p-10 w-full rounded-[2rem] shadow-2xl" id="expense-voucher">
              <Receipt {...expenseReceipt} />
            </div>
            <div className="flex gap-4 w-full">
              <button onClick={async () => {
                const el = document.getElementById('expense-voucher');
                if (!el) return;
                toast.loading('Preparing voucher...', { id: 'share' });
                try {
                  const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff' });
                  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                  if (blob) {
                    const file = new File([blob], `voucher-${expenseReceipt.invoiceNo}.png`, { type: 'image/png' });
                    if (navigator.share) { await navigator.share({ files: [file], title: 'Expense voucher', text: `Voucher for ${formData.description}` }); toast.success('Shared successfully', { id: 'share' }); }
                    else { const text = encodeURIComponent(`Expense voucher\nRef: ${expenseReceipt.invoiceNo}\nAmount: MK ${expenseReceipt.total.toLocaleString()}\nDesc: ${formData.description}`); window.open(`https://wa.me/?text=${text}`, '_blank'); toast.success('WhatsApp opened', { id: 'share' }); }
                  }
                } catch { toast.error('Failed to share', { id: 'share' }); }
              }} className="flex-1 py-5 bg-emerald-500 text-white rounded-[1.5rem] text-[10px] font-black tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 uppercase">
                <MessageSquare className="w-5 h-5" /> Share WhatsApp
              </button>
              <button type="button" onClick={() => setExpenseReceipt(null)} className="flex-1 py-5 btn-primary font-black text-[10px] tracking-widest uppercase rounded-[1.5rem]">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpensesPage;
