import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Play, Eye, EyeOff, Shield, ShieldCheck, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { accountsApi, collectApi } from '../services/api';

export default function Accounts({ showToast }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(null); // null for add, object for edit
  const [showPassword, setShowPassword] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    enabled: true
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [runningCollectId, setRunningCollectId] = useState(null);

  const fetchAccounts = () => {
    accountsApi.getAll()
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('Failed to load accounts', 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openAddModal = () => {
    setCurrentAccount(null);
    setFormData({ name: '', username: '', password: '', enabled: true });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = (account) => {
    setCurrentAccount(account);
    // Don't pre-fill password; keep it blank to indicate no change unless typed
    setFormData({
      name: account.name,
      username: account.username,
      password: '',
      enabled: account.enabled
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (currentAccount) {
      // Edit mode
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password; // Don't send empty password to backend
      }
      
      accountsApi.update(currentAccount.id, updateData)
        .then(() => {
          showToast(`Account '${updateData.name}' updated successfully`, 'success');
          fetchAccounts();
          closeModal();
          setSubmitting(false);
        })
        .catch((err) => {
          console.error(err);
          showToast(err.response?.data?.error || 'Failed to update account', 'error');
          setSubmitting(false);
        });
    } else {
      // Add mode
      if (!formData.password) {
        showToast('Password is required for new accounts', 'warning');
        setSubmitting(false);
        return;
      }
      
      accountsApi.create(formData)
        .then(() => {
          showToast(`Account '${formData.name}' created successfully`, 'success');
          fetchAccounts();
          closeModal();
          setSubmitting(false);
        })
        .catch((err) => {
          console.error(err);
          showToast(err.response?.data?.error || 'Failed to add account', 'error');
          setSubmitting(false);
        });
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete the account '${name}'? This cannot be undone.`)) {
      accountsApi.delete(id)
        .then(() => {
          showToast(`Account '${name}' deleted successfully`, 'success');
          fetchAccounts();
        })
        .catch((err) => {
          console.error(err);
          showToast('Failed to delete account', 'error');
        });
    }
  };

  const handleToggleEnable = (account) => {
    const updatedStatus = !account.enabled;
    accountsApi.update(account.id, { enabled: updatedStatus })
      .then(() => {
        showToast(
          `Account '${account.name}' has been ${updatedStatus ? 'enabled' : 'disabled'}`, 
          updatedStatus ? 'success' : 'warning'
        );
        fetchAccounts();
      })
      .catch((err) => {
        console.error(err);
        showToast('Failed to toggle account status', 'error');
      });
  };

  const handleCollectNow = (id, name) => {
    setRunningCollectId(id);
    showToast(`Queuing manual reward collection for '${name}'...`, 'info');
    
    collectApi.triggerOne(id)
      .then((res) => {
        showToast(res.message || `Manual collection triggered for '${name}'`, 'success');
        // Clear loading spinner after some time
        setTimeout(() => setRunningCollectId(null), 3000);
      })
      .catch((err) => {
        console.error(err);
        showToast(err.response?.data?.error || 'Failed to trigger collection', 'error');
        setRunningCollectId(null);
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Manage Accounts
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Configure target profiles and authentication credentials.
          </p>
        </div>
        
        <button
          onClick={openAddModal}
          className="btn-primary w-full sm:w-auto"
        >
          <Plus className="h-5 w-5" />
          Add Account
        </button>
      </div>

      {/* Grid of Accounts */}
      {accounts.length === 0 ? (
        <div className="glass-panel p-12 text-center max-w-xl mx-auto flex flex-col items-center gap-4">
          <div className="p-4 bg-purple-500/10 rounded-full border border-purple-500/20 text-purple-400">
            <Shield className="h-10 w-10" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">No Accounts Configured</h4>
            <p className="text-gray-400 text-sm mt-1">
              Add your first account credentials to start automated daily collections.
            </p>
          </div>
          <button onClick={openAddModal} className="btn-primary mt-2">
            <Plus className="h-4 w-4" />
            Add Account Credentials
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div 
              key={account.id} 
              className={`glass-panel p-6 flex flex-col justify-between h-56 transition-all duration-300 relative ${
                account.enabled ? 'border-purple-500/10' : 'border-white/5 opacity-60'
              } hover:border-purple-500/30 hover:bg-white/[0.04]`}
            >
              {/* Card top */}
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg text-white truncate max-w-[150px]">{account.name}</h4>
                    <span className="text-[10px] text-gray-500 font-mono tracking-tight block truncate max-w-[150px]">
                      Username: {account.username}
                    </span>
                  </div>
                  
                  {/* Enabled status badge and switch */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${account.enabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {account.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <button 
                      onClick={() => handleToggleEnable(account)}
                      className="text-gray-400 hover:text-white transition"
                    >
                      {account.enabled ? (
                        <ToggleRight className="h-7 w-7 text-purple-500" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-4 text-[10.5px] text-gray-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span className="font-mono text-purple-300 font-medium">Symmetric Encrypted Storage</span>
                </div>
              </div>

              {/* Card actions */}
              <div className="flex gap-2.5 mt-6 border-t border-white/5 pt-4">
                <button
                  onClick={() => handleCollectNow(account.id, account.name)}
                  disabled={!account.enabled || runningCollectId === account.id}
                  className="btn-emerald flex-1 py-2 text-xs"
                >
                  <Play className={`h-3.5 w-3.5 ${runningCollectId === account.id ? 'animate-spin' : ''}`} />
                  {runningCollectId === account.id ? 'Claiming...' : 'Collect Now'}
                </button>

                <button
                  onClick={() => openEditModal(account)}
                  className="btn-secondary px-3 py-2 text-xs"
                  title="Edit Account Details"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(account.id, account.name)}
                  className="btn-danger px-3 py-2 text-xs"
                  title="Remove Account"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pop-up modal for Add/Edit Account */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-6 bg-zinc-950/90 border-white/10 shadow-2xl relative">
            
            {/* Modal header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-xl text-white">
                {currentAccount ? 'Modify Account' : 'Configure Account'}
              </h3>
              <button 
                onClick={closeModal} 
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account Label</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Game Account 1"
                  required
                  className="glass-input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Username / Email</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="name@example.com"
                  required
                  className="glass-input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
                  {currentAccount && (
                    <span className="text-[10px] text-purple-400 font-semibold italic">Leave blank to keep current</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={currentAccount ? '••••••••' : 'Enter account password'}
                    required={!currentAccount}
                    className="glass-input w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-gray-500 hover:text-gray-300 transition"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {/* Enabled check box */}
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="enabled-checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-white/10 bg-black/40 text-purple-500 focus:ring-purple-500 focus:ring-offset-black"
                />
                <label htmlFor="enabled-checkbox" className="text-sm text-gray-300 select-none">
                  Enable automated daily checking for this account
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1"
                >
                  {submitting ? 'Saving...' : currentAccount ? 'Apply Changes' : 'Register Account'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
