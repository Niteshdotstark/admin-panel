'use client';
import { useState, useEffect } from 'react';
import axios, { isAxiosError} from 'axios';

// Define interfaces for data structures
interface Tenant {
  id: number;
  name: string;
  created_at: string;
  fb_url?: string | null;
  insta_url?: string | null;
}

interface KnowledgeBaseItem {
  id: string; // This is a string (UUID)
  filename?: string;
  file_type?: string;
  url?: string;
  category?: string;
  tenant_id: number;
  uploaded_by: number;
  created_at: string;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://ec2-3-110-27-213.ap-south-1.compute.amazonaws.com/api/';

export default function Dashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [knowledgeBaseItems, setKnowledgeBaseItems] = useState<KnowledgeBaseItem[]>([]);
  const [activeTenant, setActiveTenant] = useState<number | null>(null);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantFbUrl, setNewTenantFbUrl] = useState('');
  const [newTenantInstaUrl, setNewTenantInstaUrl] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [category, setCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [updatedName, setUpdatedName] = useState('');
  const [updatedFbUrl, setUpdatedFbUrl] = useState('');
  const [updatedInstaUrl, setUpdatedInstaUrl] = useState('');
  // States for the multi-step tenant creation form
  const [showTenantCreationForm, setShowTenantCreationForm] = useState(false);
  const [showOptionalTenantFields, setShowOptionalTenantFields] = useState(false);

  // Clear selectedFile when category is not 'file' or 'database'
  useEffect(() => {
  if (category !== 'file' && category !== 'database') {
    setSelectedFile(null);
    console.log('Cleared selectedFile because category is:', category);
  }
  }, [category]);
  // Clear newUrl when category is not 'url'
  useEffect(() => {
    if (category !== 'url') {
      setNewUrl('');
    }
  }, [category]);
  useEffect(() => {
  console.log('Knowledge Base Items:', knowledgeBaseItems);
  }, [knowledgeBaseItems]);
  // Fetch tenants on initial load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in.');
          setIsLoading(false);
          return;
        }

        // Fetch tenants
        const tenantsRes = await axios.get(`${API_URL}/tenants`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTenants(tenantsRes.data);
        if (tenantsRes.data.length > 0) {
          setActiveTenant(tenantsRes.data[0].id);
        }
      } catch (err) {
    const error = err as ApiError;
    console.error("Failed to load initial data:", error.response?.data || error.message);
    setError('Failed to load data. ' + (error.response?.data?.detail || 'Please try again.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);
  // Fetch knowledge base items when active tenant changes
  useEffect(() => {
    if (activeTenant !== null) {
      const fetchTenantData = async () => {
        try {
          setIsLoading(true);
          setError('');
          const token = localStorage.getItem('token');
          if (!token) {
            setError('Authentication token not found. Please log in.');
            setIsLoading(false);
            return;
          }

          // Fetch knowledge base items
          const itemsRes = await axios.get(`${API_URL}/tenants/${activeTenant}/knowledge_base_items/`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setKnowledgeBaseItems(itemsRes.data);
        } catch (err: unknown) {
  if (isAxiosError(err)) {
    console.error("Failed to load tenant-specific data:", err.response?.data || err.message);
    setError('Failed to load tenant data. ' + (err.response?.data?.detail || 'Please try again.'));
  } else {
    console.error("Failed to load tenant-specific data:", err);
    setError('Failed to load tenant data. Please try again.');
  }
        } finally {
          setIsLoading(false);
        }
      };

      fetchTenantData();
    } else {
      setKnowledgeBaseItems([]);
    }
  }, [activeTenant]);
  // Handler to open the tenant creation form
  const handleOpenCreateTenantForm = () => {
    setNewTenantName('');
    setNewTenantFbUrl('');
    setNewTenantInstaUrl('');
    setError('');
    setShowOptionalTenantFields(false);
    setShowTenantCreationForm(true);
  };
  // Handler to close/cancel the tenant creation form
  const handleCancelTenantCreation = () => {
    setNewTenantName('');
    setNewTenantFbUrl('');
    setNewTenantInstaUrl('');
    setError('');
    setShowOptionalTenantFields(false);
    setShowTenantCreationForm(false);
  };
  // Handler for the first step of tenant creation (name input)
  const handleInitiateTenantCreation = () => {
    if (!newTenantName.trim()) {
      setError("Organization name cannot be empty.");
      return;
    }
    setError('');
    setShowOptionalTenantFields(true);
  };
  // Handler for the final step of tenant creation (submitting all data)
  const handleFinalCreateTenant = async () => {
    if (!newTenantName.trim()) {
      setError("Organization name cannot be empty.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setIsLoading(false);
        return;
      }

      const requestBody = {
        name: newTenantName,
        fb_url: newTenantFbUrl.trim() || '',
        insta_url: newTenantInstaUrl.trim() || ''
      };

      const response = await axios.post(`${API_URL}/tenants/`, requestBody, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTenants([...tenants, response.data]);
      setActiveTenant(response.data.id);
      handleCancelTenantCreation();
      alert(`Organization "${response.data.name}" created successfully!`);
   } catch (err: unknown) {
  if (isAxiosError(err)) {
    console.error("Error creating organization:", err.response?.data || err.message);
    setError('Failed to create organization. ' + (err.response?.data?.detail || 'Please try again.'));
  } else {
    console.error("Error creating organization:", err);
    setError('Failed to create organization. Please try again.');
  }
}finally {
      setIsLoading(false);
    }
  };
 // Handler to update tenant
  const handleUpdateTenant = async (tenantId: number) => {
    if (!updatedName.trim()) {
      setError("Organization name cannot be empty.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setIsLoading(false);
        return;
      }

      const updatedTenant = {
        name: updatedName,
        fb_url: updatedFbUrl.trim() || null,
        insta_url: updatedInstaUrl.trim() || null
      };

      console.log('Updating tenant with body:', updatedTenant);
      const response = await axios.put(`${API_URL}/tenants/${tenantId}/`, updatedTenant, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Tenant update response:', response.data);

      const tenantsRes = await axios.get(`${API_URL}/tenants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTenants(tenantsRes.data);
      handleCancelEditTenant();
      alert(`Organization "${response.data.name}" updated successfully!`);
    } catch (err: unknown) {
  if (isAxiosError(err)) {
    console.error("Error updating organization:", err.response?.data || err.message);
    setError('Failed to update organization. ' + (err.response?.data?.detail || 'Please try again.'));
  } else {
    console.error("Error updating organization:", err);
    setError('Failed to update organization. Please try again.');
  }
} finally {
      setIsLoading(false);
    }
  };
  // Handler to open the tenant edit form
  const handleOpenEditTenantForm = (tenant: Tenant) => {
      setEditingTenant(tenant);
      setUpdatedName(tenant.name);
      setUpdatedFbUrl(tenant.fb_url || '');
      setUpdatedInstaUrl(tenant.insta_url || '');
  };
  // Handler to close/cancel the tenant edit form
  const handleCancelEditTenant = () => {
      setEditingTenant(null);
      setUpdatedName('');
      setUpdatedFbUrl('');
      setUpdatedInstaUrl('');
      setError('');
  };
  // Handler to add a knowledge base item
  const handleAddItem = async () => {
  // Validation
  if (!category) {
    setError('Please select a type.');
    return;
  }
  if (category === 'url' && !newUrl.trim()) {
    setError('Please provide a URL.');
    return;
  }
  if ((category === 'file' || category === 'database') && !selectedFile) {
    setError('Please select a file.');
    return;
  }

  try {
    setIsLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token not found. Please log in.');
      setIsLoading(false);
      return;
    }

    // Create FormData
    const formData = new FormData();
    if (category === 'url') {
      formData.append('url', newUrl);
      await axios.post(
        `${API_URL}/tenants/${activeTenant}/knowledge_base_items/add_url`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
    } else if (selectedFile) { // Type guard to ensure selectedFile is not null
      formData.append('file', selectedFile);
      formData.append('category', category);
      await axios.post(
        `${API_URL}/tenants/${activeTenant}/knowledge_base_items/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
    } else {
      throw new Error('No file selected for file or database category.');
    }

    // Refresh knowledge base items
    const itemsRes = await axios.get(
      `${API_URL}/tenants/${activeTenant}/knowledge_base_items/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    setKnowledgeBaseItems(itemsRes.data);
    setNewUrl('');
    setSelectedFile(null);
    setCategory('');
 } catch (err: unknown) {
  if (isAxiosError(err)) {
    console.error("Failed to add item:", err.response?.data || err.message);
    setError('Failed to add item. ' + (err.response?.data?.detail || 'Please try again.'));
  } else {
    console.error("Failed to add item:", err);
    setError('Failed to add item. Please try again.');
  }
} finally {
    setIsLoading(false);
  }
  };
  return (
    <main className="max-w-6xl mx-auto mt-8 p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Multi-Tenant Dashboard</h1>
        <div className="flex items-center space-x-4">
          <a
      href="/Chat"
      className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
    >
      Open Chat
    </a>
          <button
            onClick={handleOpenCreateTenantForm}
            className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
            disabled={isLoading}
          >
            + New Organization
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Tenant Creation Form */}
      {showTenantCreationForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">
              {showOptionalTenantFields ? 'Add Organization Details' : 'Create New Organization'}
            </h2>
            <div className="space-y-4">
              {!showOptionalTenantFields ? (
                <div>
                  <label htmlFor="newTenantName" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    id="newTenantName"
                    placeholder="e.g., My Company Inc."
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <>
                  <div className="text-gray-700 mb-4">
                    <p className="font-medium">Organization Name: <span className="font-normal text-indigo-600">{newTenantName}</span></p>
                    <p className="text-sm text-gray-500">Add optional social media links.</p>
                  </div>
                  <div>
                    <label htmlFor="newTenantFbUrl" className="block text-sm font-medium text-gray-700 mb-1">
                      Facebook URL (Optional)
                    </label>
                    <input
                      type="text"
                      id="newTenantFbUrl"
                      placeholder="https://www.facebook.com/your-org"
                      value={newTenantFbUrl}
                      onChange={(e) => setNewTenantFbUrl(e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="newTenantInstaUrl" className="block text-sm font-medium text-gray-700 mb-1">
                      Instagram URL (Optional)
                    </label>
                    <input
                      type="text"
                      id="newTenantInstaUrl"
                      placeholder="https://www.instagram.com/your-org"
                      value={newTenantInstaUrl}
                      onChange={(e) => setNewTenantInstaUrl(e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleCancelTenantCreation}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              {!showOptionalTenantFields ? (
                <button
                  onClick={handleInitiateTenantCreation}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  disabled={isLoading}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleFinalCreateTenant}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Complete Creation'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

       {/* Tenant Edit Form */}
      {editingTenant && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Edit Organization</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="updatedName" className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  id="updatedName"
                  value={updatedName}
                  onChange={(e) => setUpdatedName(e.target.value)}
                  className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="updatedFbUrl" className="block text-sm font-medium text-gray-700 mb-1">Facebook URL (Optional)</label>
                <input
                  type="text"
                  id="updatedFbUrl"
                  value={updatedFbUrl}
                  onChange={(e) => setUpdatedFbUrl(e.target.value)}
                  className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="updatedInstaUrl" className="block text-sm font-medium text-gray-700 mb-1">Instagram URL (Optional)</label>
                <input
                  type="text"
                  id="updatedInstaUrl"
                  value={updatedInstaUrl}
                  onChange={(e) => setUpdatedInstaUrl(e.target.value)}
                  className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleCancelEditTenant}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateTenant(editingTenant.id)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Selection */}
      <div className="mb-8 bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Organizations</h2>
        </div>

        {isLoading && tenants.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No organizations yet</h3>
           <p className="text-gray-500">
  {`Create your first organization using the "+ New Organization" button above.`}
</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tenants.map(tenant => (
              <div
                key={tenant.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  activeTenant === tenant.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setActiveTenant(tenant.id)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-medium">{tenant.name}</h3>
                  {activeTenant === tenant.id && (
                    <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Created: {new Date(tenant.created_at).toLocaleDateString()}
                </p>
                {tenant.fb_url && <p className="text-sm text-blue-600 truncate">FB: {tenant.fb_url}</p>}
                {tenant.insta_url && <p className="text-sm text-purple-600 truncate">Insta: {tenant.insta_url}</p>}
                <button
                  onClick={() => handleOpenEditTenantForm(tenant)}
                  className="mt-2 bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Base Section */}
      {activeTenant !== null && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              Knowledge Base for {tenants.find(t => t.id === activeTenant)?.name || 'Selected Organization'}
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border rounded-md px-3 py-2"
              >
                <option value="">Select type</option>
                <option value="file">File</option>
                <option value="url">URL</option>
                <option value="database">Database File</option>
              </select>
              {category === 'file' && (
                <input
                  type="file"
                  accept=".pdf,.csv,.xml,.txt,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="border rounded-md px-3 py-2"
                />
              )}
              {category === 'url'&& (
                <input
                  type="text"
                  placeholder="Enter URL"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="border rounded-md px-3 py-2"
                />
              )}
              {category === 'database' && (
                <input
                  type="file"
                  accept=".bacpac,.sqlite,.db,.sql"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="border rounded-md px-3 py-2"
                />
              )}
              <button
                onClick={handleAddItem}
                className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
                disabled={isLoading || !category || (category === 'url' && !newUrl.trim()) || ((category === 'file' || category === 'database') && !selectedFile)}
              >
                Add
              </button>
            </div>
          </div>

          {isLoading && knowledgeBaseItems.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : knowledgeBaseItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No knowledge base items yet</h3>
              <p className="text-gray-500">Upload files or save URLs to build your knowledge base</p>
            </div>
          ) : (
            // Update the rendering section in the Knowledge Base section
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {knowledgeBaseItems.map(item => (
                <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  {item.category === 'url' || item.url ? (
                    <>
                      <div className="flex items-center space-x-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                        </svg>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline truncate">{item.url || 'No URL'}</a>
                      </div>
                      <p className="text-sm text-gray-500">Type: URL</p>
                      <p className="text-sm text-gray-500">Saved: {new Date(item.created_at).toLocaleDateString()}</p>
                    </>
                  ) : item.category === 'file' || item.category === 'database' || item.filename ? (
                    <>
                      <div className="flex items-center space-x-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium truncate">{item.filename || 'No File'}</span>
                      </div>
                      <p className="text-sm text-gray-500">Type: {item.category === 'file' ? 'File' : item.category === 'database' ? 'Database File' : item.file_type || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">Uploaded: {new Date(item.created_at).toLocaleDateString()}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Unknown item type (ID: {item.id})</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}