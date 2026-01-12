import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Select from 'react-select';
import { Plus, Edit, Trash2, Search, Loader2, Upload, Download, X, CheckCircle, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, passwordRequirements } from '../utils/validation';

const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  // School filter state for school admin
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });
  const [schools, setSchools] = useState([]);
  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id)
        .then(res => setSchools(res.data.schools || []))
        .catch(() => setSchools([]));
    }
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student'
  });
  const [uploadStep, setUploadStep] = useState(1); // 1: Upload, 2: Validate, 3: Results
  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    fetchUsers();
    // Listen for school selection changes from SchoolSwitcher
    const handler = (e) => {
      try {
        const newSchools = JSON.parse(localStorage.getItem('selectedSchools')) || [];
        setSelectedSchools(newSchools);
      } catch (err) {
        console.error('Error parsing school selection:', err);
      }
      fetchUsers();
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [selectedSchools]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(u =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.role?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    if (users.length === 0) setLoading(true);
    try {
      // Teachers see only their enrolled students
      if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
        const response = await api.get('/users/my-students');
        setUsers(response.data.students);
        setFilteredUsers(response.data.students);
      } else {
        // Root admin and school admin see users based on their permissions
        const response = await api.get('/users');
        let filtered = response.data.users;
        if (user?.role === 'school_admin' && selectedSchools.length > 0) {
          filtered = filtered.filter(u => {
            if (Array.isArray(u.schoolId)) {
              return u.schoolId.some(sid => selectedSchools.includes(sid?._id || sid));
            }
            return selectedSchools.includes(u.schoolId?._id || u.schoolId);
          });
        }
        setUsers(filtered);
        setFilteredUsers(filtered);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!validateEmail(formData.email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (!validatePassword(formData.password)) {
      toast.error(passwordRequirements);
      return;
    }

    try {
      const submitData = { ...formData };
      if (user?.role === 'school_admin') {
        let schoolIdToSend = null;

        // If 'All' is selected, assign all school IDs
        if (submitData.schoolIds && submitData.schoolIds.length > 0) {
          // Check if all schools are selected (equivalent to 'ALL')
          const allSelected = submitData.schoolIds.length === schools.length &&
            schools.every(s => submitData.schoolIds.includes(s._id));

          if (allSelected || submitData.schoolIds.includes('ALL')) {
            // Send all school IDs as an array
            schoolIdToSend = schools.map(s => s._id);
          } else {
            // Send selected school IDs as array (backend handles arrays)
            schoolIdToSend = submitData.schoolIds.filter(id => id !== 'ALL');
          }
        } else if (!submitData.schoolIds || submitData.schoolIds.length === 0) {
          // If no school selected in form, use the selected school from dropdown
          if (selectedSchools.length > 0) {
            schoolIdToSend = selectedSchools;
          } else {
            toast.error('Please select a school from the header dropdown first');
            return;
          }
        }

        // Send as schoolId (singular) to match backend expectation
        submitData.schoolId = schoolIdToSend;
        // Remove schoolIds from submitData to avoid confusion
        delete submitData.schoolIds;
      }
      await api.post('/users', submitData, { skipLoader: true });
      toast.success('User created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', email: '', password: '', role: 'student', schoolIds: [] });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsUploading(true);
    setUploadResults(null);
    setParsedData([]);
    setValidationErrors([]);

    try {
      // Parse CSV file
      const text = await csvFile.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const data = [];
      const errors = [];
      const emailSet = new Set();

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const row = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Basic validation
        const rowErrors = [];

        if (!row.name) {
          rowErrors.push('Name is required');
        }

        if (!row.email) {
          rowErrors.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          rowErrors.push('Invalid email format');
        } else if (emailSet.has(row.email.toLowerCase())) {
          rowErrors.push('Duplicate email in CSV');
        } else {
          emailSet.add(row.email.toLowerCase());
        }

        // Check if user already exists
        try {
          const existingUsers = users.filter(u => u.email.toLowerCase() === row.email.toLowerCase());
          if (existingUsers.length > 0) {
            rowErrors.push('User already exists in system');
          }
        } catch (err) {
          // Continue if check fails
        }

        // Validate role
        const validRoles = ['student', 'teacher', 'personal_teacher'];
        if (user?.role === 'root_admin') {
          validRoles.push('school_admin');
        }

        if (row.role && !validRoles.includes(row.role)) {
          rowErrors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        // Validate school if provided
        if (row.school) {
          const schoolExists = schools.find(s =>
            s.name.toLowerCase() === row.school.toLowerCase() ||
            s._id === row.school
          );
          if (!schoolExists) {
            rowErrors.push(`School "${row.school}" not found`);
          } else {
            row.schoolId = schoolExists._id;
            row.schoolName = schoolExists.name;
          }
        }

        data.push({
          ...row,
          rowNumber: i + 1,
          errors: rowErrors,
          valid: rowErrors.length === 0
        });

        if (rowErrors.length > 0) {
          errors.push({
            row: i + 1,
            email: row.email || 'N/A',
            errors: rowErrors
          });
        }
      }

      setParsedData(data);
      setValidationErrors(errors);
      setUploadStep(2); // Move to validation step

    } catch (error) {
      toast.error('Error parsing CSV: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmBulkUpload = async () => {
    setIsUploading(true);
    setUploadResults(null);

    try {
      const validUsers = parsedData.filter(u => u.valid);

      if (validUsers.length === 0) {
        toast.error('No valid users to upload');
        setIsUploading(false);
        return;
      }

      const formDataToSend = new FormData();

      // Create a new CSV with only valid users
      const csvContent = 'name,email,role,school\n' +
        validUsers.map(u => `${u.name},${u.email},${u.role || 'student'},${u.school || ''}`).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      formDataToSend.append('csvFile', blob, 'validated_users.csv');
      formDataToSend.append('role', 'student'); // Default, will be overridden by CSV

      if (user?.role === 'school_admin' && selectedSchools.length > 0) {
        formDataToSend.append('schoolId', JSON.stringify(selectedSchools));
      }

      const response = await api.post('/users/bulk-invite', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipLoader: true
      });

      setUploadResults(response.data);
      setUploadStep(3); // Move to results step
      toast.success(`Successfully processed ${response.data.successful} users`);

      if (response.data.failed > 0) {
        toast.error(`${response.data.failed} users failed to process`);
      }

      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error uploading CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = `name,email,role,school
John Doe,john@example.com,student,${schools[0]?.name || 'School Name'}
Jane Smith,jane@example.com,teacher,${schools[0]?.name || 'School Name'}
Bob Johnson,bob@example.com,student,`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting user');
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'root_admin':
        return 'bg-red-100 text-red-800';
      case 'school_admin':
        return 'bg-orange-100 text-orange-800';
      case 'teacher':
      case 'personal_teacher':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            {user?.role === 'teacher' || user?.role === 'personal_teacher'
              ? 'My Students'
              : 'User Management'}
          </h2>
          {['root_admin', 'school_admin'].includes(user?.role) && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const currentSelected = JSON.parse(localStorage.getItem('selectedSchools') || '[]');
                  if (user?.role === 'school_admin' && currentSelected.length > 0) {
                    setFormData({
                      name: '',
                      email: '',
                      password: '',
                      role: 'student',
                      schoolIds: currentSelected
                    });
                  } else {
                    setFormData({ name: '', email: '', password: '', role: 'student', schoolIds: [] });
                  }
                  setShowCreateModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create User</span>
              </button>
              <button
                onClick={() => {
                  setCsvFile(null);
                  setUploadResults(null);
                  setShowBulkUploadModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Upload</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                )}
                {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {user?.role === 'root_admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((u) => (
                <tr key={u._id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(u.role)}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                  )}
                  {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {Array.isArray(u.schoolId)
                        ? u.schoolId.map(s => s?.name || (schools.find(sch => sch._id === s)?.name || s)).join(', ')
                        : (u.schoolId?.name || schools.find(sch => sch._id === u.schoolId)?.name || u.schoolName || u.schoolId || '')}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-green-600">
                    {u.isActive !== false ? 'Active' : 'Inactive'}
                  </td>
                  {user?.role === 'root_admin' && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(u._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              {searchQuery.trim() !== ''
                ? 'No users found matching your search'
                : user?.role === 'teacher' || user?.role === 'personal_teacher'
                  ? 'No students enrolled in your classes yet'
                  : 'No users found'}
            </p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4">Create User</h3>
            <form onSubmit={(e) => { setIsCreating(true); handleCreate(e); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                  minLength="6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="personal_teacher">Personal Teacher</option>
                  {user?.role === 'root_admin' && (
                    <>
                      <option value="school_admin">School Admin</option>
                      <option value="root_admin">Root Admin</option>
                    </>
                  )}
                </select>
              </div>
              {user?.role === 'school_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School(s)</label>
                  <Select
                    isMulti
                    options={[{ value: 'ALL', label: 'All' }, ...schools.map(s => ({ value: s._id, label: s.name }))]}
                    value={formData.schoolIds && formData.schoolIds.length > 0
                      ? (formData.schoolIds.length === schools.length
                        ? [{ value: 'ALL', label: 'All' }]
                        : formData.schoolIds.map(id => {
                          if (id === 'ALL') return { value: 'ALL', label: 'All' };
                          const school = schools.find(s => s._id === id);
                          return school ? { value: school._id, label: school.name } : null;
                        }).filter(Boolean))
                      : (selectedSchools.length > 0
                        ? selectedSchools.map(id => {
                          const school = schools.find(s => s._id === id);
                          return school ? { value: school._id, label: school.name } : null;
                        }).filter(Boolean)
                        : [])
                    }
                    onChange={selected => {
                      if (selected.some(opt => opt.value === 'ALL')) {
                        setFormData({ ...formData, schoolIds: schools.map(s => s._id) });
                      } else {
                        setFormData({ ...formData, schoolIds: selected.map(opt => opt.value) });
                      }
                    }}
                    classNamePrefix="react-select"
                    placeholder="Select school(s)..."
                  />
                  <small className="text-gray-500">
                    {selectedSchools.length > 0
                      ? `Default: ${schools.find(s => s._id === selectedSchools[0])?.name || 'Selected school'}. Select multiple schools or 'All'.`
                      : 'Select multiple schools or \'All\'.'}
                  </small>
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
                >
                  Create
                  {isCreating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Bulk Upload Users via CSV</h3>
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-500">Step {uploadStep} of 3</div>
                <button
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setCsvFile(null);
                    setUploadStep(1);
                    setParsedData([]);
                    setValidationErrors([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Step 1: Upload CSV */}
            {uploadStep === 1 && (
              <>
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-3">
                    <strong>📋 CSV Format Requirements:</strong>
                  </p>
                  <div className="bg-white p-3 rounded border border-blue-100 mb-3">
                    <p className="text-xs font-mono text-gray-700 mb-1">Required columns:</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                      <li><code className="bg-gray-100 px-1 rounded">name</code> - Full name of the user</li>
                      <li><code className="bg-gray-100 px-1 rounded">email</code> - Valid email address</li>
                    </ul>
                    <p className="text-xs font-mono text-gray-700 mb-1 mt-2">Optional columns:</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                      <li><code className="bg-gray-100 px-1 rounded">role</code> - student, teacher, personal_teacher{user?.role === 'root_admin' ? ', school_admin' : ''}</li>
                      <li><code className="bg-gray-100 px-1 rounded">school</code> - School name (must match existing school)</li>
                    </ul>
                  </div>
                  <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                    <li>Each user will receive an invite email with a unique link</li>
                    <li>Invite links expire in 7 days</li>
                    <li>Duplicate emails will be rejected</li>
                  </ul>
                </div>

                <div className="mb-6 flex justify-center">
                  <button
                    onClick={downloadSampleCSV}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition shadow-lg transform hover:scale-105"
                  >
                    <Download className="w-5 h-5" />
                    <span className="font-semibold">Download Sample CSV Template</span>
                  </button>
                </div>

                <form onSubmit={handleBulkUpload} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select CSV File</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      className="w-full px-4 py-2 border rounded-lg"
                      required
                    />
                    {csvFile && (
                      <p className="text-sm text-green-600 mt-1 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Selected: {csvFile.name}
                      </p>
                    )}
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkUploadModal(false);
                        setCsvFile(null);
                        setUploadStep(1);
                      }}
                      className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        'Next: Validate Data'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Step 2: Validation Preview */}
            {uploadStep === 2 && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Validation Summary</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Total rows: {parsedData.length} |
                        <span className="text-green-600 ml-1 font-semibold">✓ Valid: {parsedData.filter(u => u.valid).length}</span> |
                        <span className="text-red-600 ml-1 font-semibold">✗ Invalid: {validationErrors.length}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4 max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Role</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">School</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedData.map((row, idx) => (
                        <tr key={idx} className={row.valid ? 'bg-white' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-gray-600">{row.rowNumber}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-xs">{row.email}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {row.role || 'student'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">{row.schoolName || row.school || '-'}</td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <span className="flex items-center text-green-600 text-xs font-semibold">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Valid
                              </span>
                            ) : (
                              <div>
                                <span className="flex items-center text-red-600 text-xs mb-1 font-semibold">
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Invalid
                                </span>
                                <ul className="text-xs text-red-600 list-disc list-inside">
                                  {row.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {validationErrors.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ <strong>Warning:</strong> {validationErrors.length} row(s) have errors and will be skipped.
                      Only valid users will be uploaded.
                    </p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadStep(1);
                      setParsedData([]);
                      setValidationErrors([]);
                    }}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={confirmBulkUpload}
                    disabled={isUploading || parsedData.filter(u => u.valid).length === 0}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      `Upload ${parsedData.filter(u => u.valid).length} Valid User(s) & Send Invites`
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Results */}
            {uploadStep === 3 && uploadResults && (
              <>
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Upload Complete!
                  </h4>
                  <p className="text-sm text-green-700">✓ Successfully processed: {uploadResults.successful} users</p>
                  <p className="text-sm text-gray-600 mt-1">Invite emails have been sent to all users.</p>
                  {uploadResults.failed > 0 && (
                    <p className="text-sm text-red-700 mt-1">✗ Failed: {uploadResults.failed} users</p>
                  )}
                </div>

                {uploadResults.errors && uploadResults.errors.length > 0 && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                    <div className="max-h-40 overflow-y-auto">
                      {uploadResults.errors.map((err, idx) => (
                        <p key={idx} className="text-xs text-red-600">
                          Row {err.row}: {err.email} - {err.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowBulkUploadModal(false);
                      setCsvFile(null);
                      setUploadResults(null);
                      setParsedData([]);
                      setValidationErrors([]);
                      setUploadStep(1);
                    }}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Users;

