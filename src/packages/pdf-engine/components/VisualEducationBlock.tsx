import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { VisualAsset } from '../../visual-library/types';

// NOTE: @react-pdf/renderer's <Image> fetches the src URL at render time.
// Visual asset CDN URLs are not yet live — using them crashes the PDF renderer
// with a network error. Images are intentionally omitted until the CDN is set up.
// The caption + explanation carry the full educational value.

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  accentBar: {
    height: 4,
    backgroundColor: '#0284C7',
  },
  contentBlock: {
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  caption: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  explanation: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.55,
  },
});

export const VisualEducationBlock = ({ asset }: { asset: VisualAsset }) => {
  return (
    <View style={styles.container}>
      <View style={styles.accentBar} />
      <View style={styles.contentBlock}>
        <Text style={styles.caption}>{asset.defaultCaption ?? ''}</Text>
        <Text style={styles.explanation}>{asset.defaultExplanation ?? ''}</Text>
      </View>
    </View>
  );
};
