import React from 'react';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const StudentReportTable = ({ students, classroomName }) => {

    const exportCSV = () => {
        const headers = ['Name', 'Email', 'Assignments Submitted', 'Total Assignments', 'Avg Score (%)', 'Attendance (%)', 'Classes Attended', 'Total Classes'];
        const rows = students.map(s => [
            s.name,
            s.email,
            s.assignmentsSubmitted,
            s.totalAssignments,
            s.averagePercentage,
            (s.attendancePercentage || 0),
            (s.classesAttended || 0),
            (s.totalClasses || 0)
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${classroomName}_Report_Card.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text(`Student Report Card: ${classroomName}`, 14, 15);

        const tableColumn = ["Name", "Email", "Submissions", "Avg Score %", "Attendance %", "Classes"];
        const tableRows = [];

        students.forEach(s => {
            const studentData = [
                s.name,
                s.email,
                `${s.assignmentsSubmitted}/${s.totalAssignments}`,
                `${s.averagePercentage}%`,
                `${s.attendancePercentage || 0}%`,
                `${s.classesAttended || 0}/${s.totalClasses || 0}`
            ];
            tableRows.push(studentData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`${classroomName}_Report_Card.pdf`);
    };

    if (!students || students.length === 0) {
        return <div className="text-gray-500 text-center py-4">No student data available.</div>;
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">Student Report Cards</h3>
                <div className="flex space-x-2">
                    <button
                        onClick={exportCSV}
                        className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                    >
                        <FileText size={16} />
                        <span>CSV</span>
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition"
                    >
                        <Download size={16} />
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3 text-center">Assignments</th>
                            <th className="px-4 py-3 text-center">Avg Score</th>
                            <th className="px-4 py-3 text-center">Attendance</th>
                            <th className="px-4 py-3 text-center rounded-tr-lg">Classes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {students.map((student) => (
                            <tr key={student.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{student.name}</td>
                                <td className="px-4 py-3 text-gray-500">{student.email}</td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                    {student.assignmentsSubmitted} / {student.totalAssignments}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`font-bold ${student.averagePercentage >= 70 ? 'text-green-600' :
                                        student.averagePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                        {student.averagePercentage}%
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`font-bold ${student.attendancePercentage >= 75 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {student.attendancePercentage || 0}%
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                    {student.classesAttended || 0} / {student.totalClasses || 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StudentReportTable;
