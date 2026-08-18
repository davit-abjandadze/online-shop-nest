import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Question } from '../question/entities/question.entity';
import { UserAnswer } from '../user-answer/entities/user-answer.entity';
import { Category } from '../category/entities/category.entity';
import { TrendsPeriod } from './dto/trends-query.dto';

export interface GlobalStats {
  totalUsers: number;
  totalVotes: number;
  totalQuestions: number;
  activeToday: number;
  growthRate: number;
}

export interface DailyVotes {
  date: string;
  votes: number;
}

export interface TrendsStats {
  period: TrendsPeriod;
  dailyVotes: DailyVotes[];
  peakHour: number;
  trend: 'up' | 'down' | 'stable';
}

// პოპულარულ განცხადებად ჩასათვლელად საჭირო მინიმალური ხმების რაოდენობა (20-ზე მეტი)
const POPULAR_QUESTION_MIN_VOTES = 20;

const PERIOD_DAYS: Record<TrendsPeriod, number> = {
  week: 7,
  month: 30,
  year: 365,
};

export interface MostActiveQuestion {
  id: number;
  text: string;
  votes: number;
}

export interface CategoryStats {
  id: number;
  name: string;
  totalQuestions: number;
  totalVotes: number;
  avgParticipation: number;
  mostActiveQuestion: MostActiveQuestion | null;
}

export interface MostVotedQuestion {
  id: number;
  text: string;
  votes: number;
  category: string;
}

export interface MostControversialQuestion {
  id: number;
  text: string;
  votes: number;
  controversyScore: number;
}

export interface FastestGrowingQuestion {
  id: number;
  text: string;
  votesToday: number;
  growthRate: number;
}

export interface PopularQuestionsStats {
  mostVoted: MostVotedQuestion[];
  mostControversial: MostControversialQuestion[];
  fastestGrowing: FastestGrowingQuestion[];
}

// ასაკობრივი ჯგუფები, რომლის მიხედვითაც იჯგუფება ხმები
export type AgeGroup =
  | 'under_18'
  | '18_24'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_64'
  | '65_plus'
  | 'unknown';

const ALL_AGE_GROUPS: AgeGroup[] = [
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_64',
  '65_plus',
  'unknown',
];

type GenderKey = 'male' | 'female' | 'unknown';

const ALL_GENDERS: GenderKey[] = ['male', 'female', 'unknown'];

// user.age-ის მიხედვით ასაკობრივ ჯგუფად დამყოფი SQL გამოსახულება
const AGE_GROUP_SQL = `CASE
  WHEN "user"."age" IS NULL THEN 'unknown'
  WHEN "user"."age" < 18 THEN 'under_18'
  WHEN "user"."age" BETWEEN 18 AND 24 THEN '18_24'
  WHEN "user"."age" BETWEEN 25 AND 34 THEN '25_34'
  WHEN "user"."age" BETWEEN 35 AND 44 THEN '35_44'
  WHEN "user"."age" BETWEEN 45 AND 54 THEN '45_54'
  WHEN "user"."age" BETWEEN 55 AND 64 THEN '55_64'
  ELSE '65_plus'
END`;

// user.gender-ის მიხედვით ჯგუფვა (null → 'unknown')
const GENDER_SQL = `COALESCE("user"."gender"::text, 'unknown')`;

export interface GenderVotes {
  gender: GenderKey;
  votes: number;
}

export interface AgeGroupVotes {
  ageGroup: AgeGroup;
  votes: number;
}

export interface DemographicsStats {
  totalVotes: number;
  byGender: GenderVotes[];
  byAge: AgeGroupVotes[];
}

export interface AnswerDemographics {
  id: number;
  text: string;
  votes: number;
  byGender: GenderVotes[];
  byAge: AgeGroupVotes[];
}

export interface QuestionDemographicsStats {
  questionId: number;
  text: string;
  totalVotes: number;
  byGender: GenderVotes[];
  byAge: AgeGroupVotes[];
  answers: AnswerDemographics[];
}

function buildGenderVotes(
  raw: { gender: string; votes: string }[],
): GenderVotes[] {
  const votesByGender = new Map<string, number>(
    raw.map((row) => [row.gender, Number(row.votes)]),
  );
  return ALL_GENDERS.map((gender) => ({
    gender,
    votes: votesByGender.get(gender) ?? 0,
  }));
}

function buildAgeGroupVotes(
  raw: { ageGroup: string; votes: string }[],
): AgeGroupVotes[] {
  const votesByAgeGroup = new Map<string, number>(
    raw.map((row) => [row.ageGroup, Number(row.votes)]),
  );
  return ALL_AGE_GROUPS.map((ageGroup) => ({
    ageGroup,
    votes: votesByAgeGroup.get(ageGroup) ?? 0,
  }));
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(UserAnswer)
    private userAnswerRepository: Repository<UserAnswer>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async getGlobalStats(): Promise<GlobalStats> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfThisWeek = new Date();
    startOfThisWeek.setDate(startOfThisWeek.getDate() - 7);

    const startOfPrevWeek = new Date();
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 14);

    const [
      totalUsers,
      totalVotes,
      totalQuestions,
      activeTodayResult,
      usersThisWeek,
      usersPrevWeek,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userAnswerRepository.count(),
      this.questionRepository.count(),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select('COUNT(DISTINCT ua.userId)', 'count')
        .where('ua.createdAt >= :startOfToday', { startOfToday })
        .getRawOne<{ count: string }>(),
      this.userRepository.count({
        where: {
          createdAt: Between(startOfThisWeek, new Date()),
        },
      }),
      this.userRepository.count({
        where: {
          createdAt: Between(startOfPrevWeek, startOfThisWeek),
        },
      }),
    ]);

    const activeToday = Number(activeTodayResult?.count ?? 0);

    let growthRate = 0;
    if (usersPrevWeek > 0) {
      growthRate = ((usersThisWeek - usersPrevWeek) / usersPrevWeek) * 100;
    } else if (usersThisWeek > 0) {
      growthRate = 100;
    }
    growthRate = Math.round(growthRate * 10) / 10;

    return {
      totalUsers,
      totalVotes,
      totalQuestions,
      activeToday,
      growthRate,
    };
  }

  async getTrends(period: TrendsPeriod = 'week'): Promise<TrendsStats> {
    const days = PERIOD_DAYS[period];

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const [rawDailyVotes, peakHourResult] = await Promise.all([
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select("TO_CHAR(ua.createdAt, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'votes')
        .where('ua.createdAt >= :startDate', { startDate })
        .groupBy("TO_CHAR(ua.createdAt, 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; votes: string }>(),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select('EXTRACT(HOUR FROM ua.createdAt)', 'hour')
        .addSelect('COUNT(*)', 'count')
        .where('ua.createdAt >= :startDate', { startDate })
        .groupBy('hour')
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawOne<{ hour: string; count: string }>(),
    ]);

    const votesByDate = new Map<string, number>(
      rawDailyVotes.map((row) => [row.date, Number(row.votes)]),
    );

    const dailyVotes: DailyVotes[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().slice(0, 10);
      dailyVotes.push({ date: dateKey, votes: votesByDate.get(dateKey) ?? 0 });
    }

    const peakHour = peakHourResult
      ? Math.round(Number(peakHourResult.hour))
      : 0;

    const lastThree = dailyVotes.slice(-3).reduce((sum, d) => sum + d.votes, 0);
    const prevThree = dailyVotes
      .slice(-6, -3)
      .reduce((sum, d) => sum + d.votes, 0);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (lastThree > prevThree) {
      trend = 'up';
    } else if (lastThree < prevThree) {
      trend = 'down';
    }

    return {
      period,
      dailyVotes,
      peakHour,
      trend,
    };
  }

  async getCategoriesStats(): Promise<{ categories: CategoryStats[] }> {
    const [categories, questions, questionVotes] = await Promise.all([
      this.categoryRepository.find(),
      this.questionRepository.find({ relations: { categories: true } }),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select('ua.questionId', 'questionId')
        .addSelect('COUNT(*)', 'votes')
        .groupBy('ua.questionId')
        .getRawMany<{ questionId: number; votes: string }>(),
    ]);

    const votesByQuestionId = new Map<number, number>(
      questionVotes.map((row) => [Number(row.questionId), Number(row.votes)]),
    );

    const categoryStats: CategoryStats[] = categories.map((category) => {
      const categoryQuestions = questions.filter((question) =>
        question.categories?.some((c) => c.id === category.id),
      );
      const totalQuestions = categoryQuestions.length;

      let totalVotes = 0;
      let mostActiveQuestion: MostActiveQuestion | null = null;

      for (const question of categoryQuestions) {
        const votes = votesByQuestionId.get(question.id) ?? 0;
        totalVotes += votes;
        if (!mostActiveQuestion || votes > mostActiveQuestion.votes) {
          mostActiveQuestion = { id: question.id, text: question.text, votes };
        }
      }

      const avgParticipation =
        totalQuestions > 0
          ? Math.round((totalVotes / totalQuestions) * 10) / 10
          : 0;

      return {
        id: category.id,
        name: category.name,
        totalQuestions,
        totalVotes,
        avgParticipation,
        mostActiveQuestion,
      };
    });

    return { categories: categoryStats };
  }

  async getPopularQuestions(limit = 10): Promise<PopularQuestionsStats> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const [
      questions,
      votesByQuestionRaw,
      votesByQuestionAndAnswerRaw,
      votesTodayRaw,
      votesYesterdayRaw,
    ] = await Promise.all([
      this.questionRepository.find({ relations: { categories: true } }),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select('ua.questionId', 'questionId')
        .addSelect('COUNT(*)', 'votes')
        .groupBy('ua.questionId')
        .getRawMany<{ questionId: number; votes: string }>(),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select('ua.questionId', 'questionId')
        .addSelect('ua.answerId', 'answerId')
        .addSelect('COUNT(*)', 'votes')
        .groupBy('ua.questionId')
        .addGroupBy('ua.answerId')
        .getRawMany<{ questionId: number; answerId: number; votes: string }>(),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select('ua.questionId', 'questionId')
        .addSelect('COUNT(*)', 'votes')
        .where('ua.createdAt >= :startOfToday', { startOfToday })
        .groupBy('ua.questionId')
        .getRawMany<{ questionId: number; votes: string }>(),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .select('ua.questionId', 'questionId')
        .addSelect('COUNT(*)', 'votes')
        .where('ua.createdAt >= :startOfYesterday', { startOfYesterday })
        .andWhere('ua.createdAt < :startOfToday', { startOfToday })
        .groupBy('ua.questionId')
        .getRawMany<{ questionId: number; votes: string }>(),
    ]);

    const questionsById = new Map(questions.map((q) => [q.id, q]));

    const totalVotesByQuestionId = new Map<number, number>(
      votesByQuestionRaw.map((row) => [
        Number(row.questionId),
        Number(row.votes),
      ]),
    );

    const maxAnswerVotesByQuestionId = new Map<number, number>();
    for (const row of votesByQuestionAndAnswerRaw) {
      const questionId = Number(row.questionId);
      const votes = Number(row.votes);
      const current = maxAnswerVotesByQuestionId.get(questionId) ?? 0;
      if (votes > current) {
        maxAnswerVotesByQuestionId.set(questionId, votes);
      }
    }

    const votesTodayByQuestionId = new Map<number, number>(
      votesTodayRaw.map((row) => [Number(row.questionId), Number(row.votes)]),
    );
    const votesYesterdayByQuestionId = new Map<number, number>(
      votesYesterdayRaw.map((row) => [
        Number(row.questionId),
        Number(row.votes),
      ]),
    );

    const mostVoted: MostVotedQuestion[] = [...totalVotesByQuestionId.entries()]
      .filter(([, votes]) => votes > POPULAR_QUESTION_MIN_VOTES)
      .map(([questionId, votes]) => {
        const question = questionsById.get(questionId);
        return {
          id: questionId,
          text: question?.text ?? '',
          votes,
          category: question?.categories?.map((c) => c.name).join(', ') ?? '',
        };
      })
      .sort((a, b) => b.votes - a.votes)
      .slice(0, limit);

    const mostControversial: MostControversialQuestion[] = [
      ...totalVotesByQuestionId.entries(),
    ]
      .filter(([, votes]) => votes > 0)
      .map(([questionId, votes]) => {
        const question = questionsById.get(questionId);
        const maxAnswerVotes = maxAnswerVotesByQuestionId.get(questionId) ?? 0;
        const controversyScore =
          Math.round((1 - maxAnswerVotes / votes) * 1000) / 1000;
        return {
          id: questionId,
          text: question?.text ?? '',
          votes,
          controversyScore,
        };
      })
      .sort((a, b) => b.controversyScore - a.controversyScore)
      .slice(0, limit);

    const fastestGrowing: FastestGrowingQuestion[] = [
      ...votesTodayByQuestionId.entries(),
    ]
      .filter(([, votesToday]) => votesToday > 0)
      .map(([questionId, votesToday]) => {
        const question = questionsById.get(questionId);
        const votesYesterday = votesYesterdayByQuestionId.get(questionId) ?? 0;
        const growthRate =
          votesYesterday > 0
            ? Math.round((votesToday / votesYesterday) * 1000) / 10
            : 100;
        return {
          id: questionId,
          text: question?.text ?? '',
          votesToday,
          growthRate,
        };
      })
      .sort((a, b) => b.growthRate - a.growthRate)
      .slice(0, limit);

    return { mostVoted, mostControversial, fastestGrowing };
  }

  // ⭐ გლობალური სტატისტიკა ხმების მიცემისას სქესისა და ასაკის მიხედვით
  async getDemographics(): Promise<DemographicsStats> {
    const [totalVotes, genderRaw, ageRaw] = await Promise.all([
      this.userAnswerRepository.count(),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .leftJoin('ua.user', 'user')
        .select(GENDER_SQL, 'gender')
        .addSelect('COUNT(*)', 'votes')
        .groupBy(GENDER_SQL)
        .getRawMany<{ gender: string; votes: string }>(),
      this.userAnswerRepository
        .createQueryBuilder('ua')
        .leftJoin('ua.user', 'user')
        .select(AGE_GROUP_SQL, 'ageGroup')
        .addSelect('COUNT(*)', 'votes')
        .groupBy(AGE_GROUP_SQL)
        .getRawMany<{ ageGroup: string; votes: string }>(),
    ]);

    return {
      totalVotes,
      byGender: buildGenderVotes(genderRaw),
      byAge: buildAgeGroupVotes(ageRaw),
    };
  }

  // ⭐ კონკრეტული კითხვის სტატისტიკა სქესისა და ასაკის მიხედვით (მთლიანად და თითო პასუხზე)
  async getQuestionDemographics(
    questionId: number,
  ): Promise<QuestionDemographicsStats> {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: { answers: true },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    const [totalVotes, genderRaw, ageRaw, answerGenderRaw, answerAgeRaw] =
      await Promise.all([
        this.userAnswerRepository.count({
          where: { question: { id: questionId } },
        }),
        this.userAnswerRepository
          .createQueryBuilder('ua')
          .leftJoin('ua.user', 'user')
          .select(GENDER_SQL, 'gender')
          .addSelect('COUNT(*)', 'votes')
          .where('ua.questionId = :questionId', { questionId })
          .groupBy(GENDER_SQL)
          .getRawMany<{ gender: string; votes: string }>(),
        this.userAnswerRepository
          .createQueryBuilder('ua')
          .leftJoin('ua.user', 'user')
          .select(AGE_GROUP_SQL, 'ageGroup')
          .addSelect('COUNT(*)', 'votes')
          .where('ua.questionId = :questionId', { questionId })
          .groupBy(AGE_GROUP_SQL)
          .getRawMany<{ ageGroup: string; votes: string }>(),
        this.userAnswerRepository
          .createQueryBuilder('ua')
          .leftJoin('ua.user', 'user')
          .select('ua.answerId', 'answerId')
          .addSelect(GENDER_SQL, 'gender')
          .addSelect('COUNT(*)', 'votes')
          .where('ua.questionId = :questionId', { questionId })
          .groupBy('ua.answerId')
          .addGroupBy(GENDER_SQL)
          .getRawMany<{ answerId: number; gender: string; votes: string }>(),
        this.userAnswerRepository
          .createQueryBuilder('ua')
          .leftJoin('ua.user', 'user')
          .select('ua.answerId', 'answerId')
          .addSelect(AGE_GROUP_SQL, 'ageGroup')
          .addSelect('COUNT(*)', 'votes')
          .where('ua.questionId = :questionId', { questionId })
          .groupBy('ua.answerId')
          .addGroupBy(AGE_GROUP_SQL)
          .getRawMany<{ answerId: number; ageGroup: string; votes: string }>(),
      ]);

    const genderByAnswerId = new Map<
      number,
      { gender: string; votes: string }[]
    >();
    for (const row of answerGenderRaw) {
      const answerId = Number(row.answerId);
      const rows = genderByAnswerId.get(answerId) ?? [];
      rows.push(row);
      genderByAnswerId.set(answerId, rows);
    }

    const ageByAnswerId = new Map<
      number,
      { ageGroup: string; votes: string }[]
    >();
    for (const row of answerAgeRaw) {
      const answerId = Number(row.answerId);
      const rows = ageByAnswerId.get(answerId) ?? [];
      rows.push(row);
      ageByAnswerId.set(answerId, rows);
    }

    const votesByAnswerId = new Map<number, number>();
    for (const row of answerGenderRaw) {
      const answerId = Number(row.answerId);
      votesByAnswerId.set(
        answerId,
        (votesByAnswerId.get(answerId) ?? 0) + Number(row.votes),
      );
    }

    const answers: AnswerDemographics[] = question.answers.map((answer) => ({
      id: answer.id,
      text: answer.text,
      votes: votesByAnswerId.get(answer.id) ?? 0,
      byGender: buildGenderVotes(genderByAnswerId.get(answer.id) ?? []),
      byAge: buildAgeGroupVotes(ageByAnswerId.get(answer.id) ?? []),
    }));

    return {
      questionId: question.id,
      text: question.text,
      totalVotes,
      byGender: buildGenderVotes(genderRaw),
      byAge: buildAgeGroupVotes(ageRaw),
      answers,
    };
  }
}
