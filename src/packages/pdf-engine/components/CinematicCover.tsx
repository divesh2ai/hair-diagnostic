import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { PatientInfo, ClinicInfo, DoctorInfo } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: '#F8FAFC', // Sleek clinical white/slate
    flexDirection: 'column',
    height: '100%',
  },
  brandTag: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#0F172A',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 40,
  },
  titleBlock: {
    marginTop: 60,
    marginBottom: 80,
  },
  mainTitle: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    lineHeight: 1.2,
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Helvetica',
  },
  patientBox: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderColor: '#3B82F6',
    marginTop: 40,
  },
  patientLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  patientName: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  patientDetails: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingTop: 20,
  },
  doctorName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  }
});

interface Props {
  patient: PatientInfo;
  clinic: ClinicInfo;
  doctor: DoctorInfo;
  date: Date;
}

export const CinematicCover = ({ patient, clinic, doctor, date }: Props) => (
  <View style={styles.page}>
    <Text style={styles.brandTag}>{clinic.name.toUpperCase()}</Text>

    <View style={styles.titleBlock}>
      <Text style={styles.mainTitle}>Comprehensive Hair & Scalp Analysis</Text>
      <Text style={styles.subTitle}>Personalized Clinical Visual Report</Text>
    </View>

    <View style={styles.patientBox}>
      <Text style={styles.patientLabel}>Patient Profile</Text>
      <Text style={styles.patientName}>{patient.name}</Text>
      <Text style={styles.patientDetails}>Age: {patient.age}  |  Gender: {patient.gender.toUpperCase()}</Text>
      <Text style={styles.patientDetails}>Assessment Date: {new Date(date).toLocaleDateString()}</Text>
    </View>

    <View style={styles.footer}>
      <Text style={styles.doctorName}>Prepared by: {doctor.name}</Text>
      <Text style={{ ...styles.subTitle, fontSize: 10, marginTop: 4 }}>This report is a visual clinical aid to guide your treatment journey.</Text>
    </View>
  </View>
);
