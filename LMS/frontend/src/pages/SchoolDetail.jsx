import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from '../utils/api';
import Layout from "../components/Layout";

export default function SchoolDetails() {
  const { id } = useParams();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      const res = await api.get(`/api/schools/${id}`);
      setSchool(res.data);
    } catch (err) {
      console.error("Error loading school:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading)
    return (
      <Layout>
        <div className="text-center py-10 text-gray-500">Loading...</div>
      </Layout>
    );

  if (!school)
    return (
      <Layout>
        <div className="text-center py-10 text-gray-500">School not found</div>
      </Layout>
    );

  return (
    <Layout>
      <div className="space-y-6">

        <h2 className="text-2xl font-bold text-gray-800">{school.name}</h2>

        <div className="bg-white shadow rounded-lg p-6 space-y-3">

          <p>
            <strong className="text-gray-700">Admin:</strong>{" "}
            {school.admin?.name} ({school.admin?.email})
          </p>

          <p>
            <strong className="text-gray-700">Teachers:</strong>{" "}
            {school.teacherCount}
          </p>

          <p>
            <strong className="text-gray-700">Students:</strong>{" "}
            {school.studentCount}
          </p>

          <p>
            <strong className="text-gray-700">Subscription:</strong>{" "}
            {school.subscriptionStatus}{" "}
            {school.subscriptionExpiry
              ? ` (expires ${new Date(school.subscriptionExpiry).toLocaleDateString()})`
              : ""}
          </p>

          <p className="text-sm text-gray-500">
            Created: {new Date(school.createdAt).toLocaleDateString()}
          </p>
        </div>

      </div>
    </Layout>
  );
}
