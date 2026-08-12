import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { TrendsQueryDto } from './dto/trends-query.dto';
import { PopularQuestionsQueryDto } from './dto/popular-questions-query.dto';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('global')
  @ApiOperation({ summary: 'გლობალური სტატისტიკა' })
  @ApiResponse({ status: 200, description: 'გლობალური სტატისტიკის მონაცემები' })
  getGlobalStats() {
    return this.statsService.getGlobalStats();
  }

  @Get('trends')
  @ApiOperation({ summary: 'ხმების ტრენდები პერიოდის მიხედვით' })
  @ApiResponse({
    status: 200,
    description: 'ყოველდღიური ხმების რაოდენობა, პიკური საათი და ტრენდის მიმართულება',
  })
  getTrends(@Query() query: TrendsQueryDto) {
    return this.statsService.getTrends(query.period);
  }

  @Get('categories')
  @ApiOperation({ summary: 'სტატისტიკა კატეგორიების მიხედვით' })
  @ApiResponse({
    status: 200,
    description:
      'თითოეული კატეგორიის კითხვების, ხმების, საშუალო აქტივობისა და ყველაზე აქტიური კითხვის მონაცემები',
  })
  getCategoriesStats() {
    return this.statsService.getCategoriesStats();
  }

  @Get('popular-questions')
  @ApiOperation({ summary: 'პოპულარული კითხვები' })
  @ApiResponse({
    status: 200,
    description:
      'ყველაზე ხმებიანი, ყველაზე კონტროვერსიული და ბოლო 24 საათში ყველაზე სწრაფად მზარდი კითხვები',
  })
  getPopularQuestions(@Query() query: PopularQuestionsQueryDto) {
    return this.statsService.getPopularQuestions(query.limit);
  }

  @Get('demographics')
  @ApiOperation({ summary: 'ხმების გლობალური სტატისტიკა სქესისა და ასაკის მიხედვით' })
  @ApiResponse({
    status: 200,
    description: 'ხმების რაოდენობა სქესის (male/female/unknown) და ასაკობრივი ჯგუფების მიხედვით',
  })
  getDemographics() {
    return this.statsService.getDemographics();
  }

  @Get('questions/:id/demographics')
  @ApiOperation({ summary: 'კონკრეტული კითხვის სტატისტიკა სქესისა და ასაკის მიხედვით (მთლიანად და თითო პასუხზე)' })
  @ApiResponse({
    status: 200,
    description: 'კითხვის ხმების განაწილება სქესისა და ასაკობრივი ჯგუფების მიხედვით, დეტალურად თითოეულ პასუხზეც',
  })
  getQuestionDemographics(@Param('id') id: string) {
    return this.statsService.getQuestionDemographics(+id);
  }
}
