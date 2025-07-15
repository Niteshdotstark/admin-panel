import React, { useState, useEffect } from 'react';
import { Plus, Building, Calendar, ExternalLink, Edit3, Trash2 } from 'lucide-react';

// Define interfaces for data structures
interface Tenant {
  id: number;
  name: string;
  created_at: string;
  fb_url?: string | null;
  insta_url?: string | null;
}

interface TenantFormData {
  name: string;
  fb_url: string;
  insta_url: string;
}

const TenantManager: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    fb_url: '',
    insta_url: ''
  });

  // Mock API calls - replace with actual API calls
  const fetchTenants = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Simulate API call
      const response = await fetch('/api/tenants');
      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }
      
      const data = await response.json();
      setTenants(data);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError('Failed to load tenants');
      
      // Mock data for demonstration
      setTenants([
        {
          id: 1,
          name: 'Acme Corporation',
          created_at: '2024-01-15T10:30:00Z',
          fb_url: 'https://facebook.com/acme',
          insta_url: 'https://instagram.com/acme'
        },
        {
          id: 2,
          name: 'Tech Innovations Ltd',
          created_at: '2024-02-20T14:45:00Z',
          fb_url: null,
          insta_url: 'https://instagram.com/techinnovations'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const createTenant = async (tenantData: TenantFormData) => {
    try {
      setError('');
      
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tenantData.name,
          fb_url: tenantData.fb_url || null,
          insta_url: tenantData.insta_url || null
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create tenant');
      }
      
      const newTenant = await response.json();
      setTenants(prev => [...prev, newTenant]);
      resetForm();
      setShowCreateForm(false);
    } catch (err) {
      console.error('Error creating tenant:', err);
      setError('Failed to create tenant');
    }
  };

  const updateTenant = async (id: number, tenantData: TenantFormData) => {
    try {
      setError('');
      
      const response = await fetch(`/api/tenants/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tenantData.name,
          fb_url: tenantData.fb_url || null,
          insta_url: tenantData.insta_url || null
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update tenant');
      }
      
      const updatedTenant = await response.json();
      setTenants(prev => prev.map(t => t.id === id ? updatedTenant : t));
      setEditingTenant(null);
      resetForm();
    } catch (err) {
      console.error('Error updating tenant:', err);
      setError('Failed to update tenant');
    }
  };

  const deleteTenant = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      return;
    }
    
    try {
      setError('');
      
      const response = await fetch(`/api/tenants/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete tenant');
      }
      
      setTenants(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting tenant:', err);
      setError('Failed to delete tenant');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      fb_url: '',
      insta_url: ''
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Organization name is required');
      return;
    }
    
    if (editingTenant) {
      await updateTenant(editingTenant.id, formData);
    } else {
      await createTenant(formData);
    }
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      fb_url: tenant.fb_url || '',
      insta_url: tenant.insta_url || ''
    });
    setShowCreateForm(true);
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingTenant(null);
    resetForm();
    setError('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
          <p className="text-gray-600 mt-2">Manage your organizations and their settings</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          New Organization
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-900">
                {editingTenant ? 'Edit Organization' : 'Create New Organization'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter organization name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    value={formData.fb_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, fb_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://facebook.com/your-org"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instagram URL
                  </label>
                  <input
                    type="url"
                    value={formData.insta_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, insta_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://instagram.com/your-org"
                  />
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    {editingTenant ? 'Update' : 'Create'} Organization
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tenants List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12">
            <Building size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first organization</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors"
            >
              <Plus size={16} />
              Create Organization
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building size={20} className="text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">{tenant.name}</h3>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                      <Calendar size={14} />
                      Created on {formatDate(tenant.created_at)}
                    </div>
                    
                    {(tenant.fb_url || tenant.insta_url) && (
                      <div className="flex flex-wrap gap-3">
                        {tenant.fb_url && (
                          <a
                            href={tenant.fb_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            <ExternalLink size={14} />
                            Facebook
                          </a>
                        )}
                        {tenant.insta_url && (
                          <a
                            href={tenant.insta_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
                          >
                            <ExternalLink size={14} />
                            Instagram
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(tenant)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit organization"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => deleteTenant(tenant.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete organization"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantManager;