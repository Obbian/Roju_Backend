import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { LocaleQueryDto } from './dto/locale-query.dto';

const DEFAULT_LOCALE = 'en-IN';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('services')
  listServices(@Query() query: LocaleQueryDto) {
    return this.catalogService.listServices(query.locale ?? DEFAULT_LOCALE);
  }

  @Get('services/:code/categories')
  listCategories(@Param('code') code: string, @Query() query: ListCategoriesQueryDto) {
    return this.catalogService.listCategoriesForServiceCity(
      code,
      query.city,
      query.locale ?? DEFAULT_LOCALE,
    );
  }

  @Get('version')
  getVersion(@Query('scope') scope = 'global') {
    return this.catalogService.getVersion(scope);
  }
}
