/**
 * services/reportService.js
 *
 * MongoDB aggregation pipelines for the HireTrail reporting engine.
 *
 * getUserReport(userId) runs 5 parallel aggregations:
 *  1. Main stats  — totalApplications, avgAtsScore
 *  2. By status   — count per pipeline stage
 *  3. Top companies — top 5 by application count
 *  4. By month    — application volume over time
 *  5. Offer stats — avgDaysToOffer (appliedDate → updatedAt when status=offer)
 */

import mongoose from 'mongoose';
import Job from '../models/Job.js';

const { Types: { ObjectId } } = mongoose;

/**
 * Full report data for a user.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   totalApplications: number,
 *   byStatus: { applied, phone_screen, technical, interview, offer, rejected, withdrawn },
 *   avgAtsScore: number|null,
 *   topCompanies: { name: string, count: number }[],
 *   applicationsByMonth: { month: string, count: number }[],
 *   avgDaysToOffer: number|null,
 * }>}
 */
export const getUserReport = async (userId) => {
  const uid = new ObjectId(userId);
  const baseMatch = { userId: uid, deletedAt: null };

  // ── Run all aggregation pipelines in parallel for performance ──────────────
  const [
    mainStatsArr,
    byStatusArr,
    topCompaniesArr,
    appsByMonthArr,
    offerStatsArr,
  ] = await Promise.all([

    // ── Pipeline 1: Total applications + avg ATS score ──────────────────────
    Job.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          // $avg ignores null — only scores that exist
          avgAtsScore: { $avg: '$atsScore' },
        },
      },
      {
        $project: {
          _id: 0,
          totalApplications: 1,
          avgAtsScore: { $round: ['$avgAtsScore', 1] },
        },
      },
    ]),

    // ── Pipeline 2: Count per status ────────────────────────────────────────
    Job.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
        },
      },
    ]),

    // ── Pipeline 3: Top 5 companies by application count ────────────────────
    Job.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$companyName',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          name: '$_id',
          count: 1,
        },
      },
    ]),

    // ── Pipeline 4: Applications grouped by calendar month ──────────────────
    Job.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: {
            year:  { $year:  '$appliedDate' },
            month: { $month: '$appliedDate' },
          },
          count: { $sum: 1 },
        },
      },
      // Sort chronologically
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          _id: 0,
          // Format as "YYYY-MM" e.g. "2024-03"
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if:   { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' },
                },
              },
            ],
          },
          count: 1,
        },
      },
    ]),

    // ── Pipeline 5: Average days from application to offer ──────────────────
    Job.aggregate([
      {
        $match: {
          ...baseMatch,
          status: 'offer',
          appliedDate: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          // updatedAt is when the status was last changed
          daysToOffer: {
            $divide: [
              { $subtract: ['$updatedAt', '$appliedDate'] },
              1000 * 60 * 60 * 24, // ms → days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDaysToOffer: { $avg: '$daysToOffer' },
        },
      },
      {
        $project: {
          _id: 0,
          avgDaysToOffer: { $round: ['$avgDaysToOffer', 0] },
        },
      },
    ]),
  ]);

  // ── Normalize results ───────────────────────────────────────────────────────
  const mainStats = mainStatsArr[0] || { totalApplications: 0, avgAtsScore: null };

  // Build byStatus object with all statuses defaulting to 0
  const byStatus = {
    applied:      0,
    phone_screen: 0,
    technical:    0,
    interview:    0,
    offer:        0,
    rejected:     0,
    withdrawn:    0,
  };
  byStatusArr.forEach(({ status, count }) => {
    if (status in byStatus) byStatus[status] = count;
  });

  return {
    totalApplications:  mainStats.totalApplications,
    avgAtsScore:        mainStats.avgAtsScore ?? null,
    byStatus,
    topCompanies:       topCompaniesArr,
    applicationsByMonth: appsByMonthArr,
    avgDaysToOffer:     offerStatsArr[0]?.avgDaysToOffer ?? null,
  };
};

export default { getUserReport };
