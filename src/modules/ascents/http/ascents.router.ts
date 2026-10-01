import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { RequestValidationError } from '../../../shared/http/request-validation-error.ts';
import type { CreateAscent } from '../application/create-ascent.ts';
import type { FindAscentsNearby } from '../application/find-ascents-nearby.ts';
import type { GetAscent } from '../application/get-ascent.ts';
import { GpxTooLargeError } from '../domain/ascent-errors.ts';
import { MAXIMUM_GPX_FILE_SIZE } from '../domain/ascent-rules.ts';
import type { PathReader } from '../domain/path-reader.ts';
import { toAscentResponse, toNearbyAscentsResponse } from './ascent.mapper.ts';
import {
  ascentIdParamsSchema,
  createAscentFieldsSchema,
  nearbyQuerySchema,
} from './ascent.schemas.ts';

export interface AscentsRouterDependencies {
  readonly createAscent: CreateAscent;
  readonly getAscent: GetAscent;
  readonly findAscentsNearby: FindAscentsNearby;
  readonly readGpxPath: PathReader;
}

const uploadSchema = createAscentFieldsSchema.extend({
  gpx: z.custom<Express.Multer.File>((file) => file !== undefined, 'A GPX file is required.'),
});

export function createAscentsRouter({
  createAscent,
  getAscent,
  findAscentsNearby,
  readGpxPath,
}: AscentsRouterDependencies): Router {
  const router = Router();

  const refuseWhenCreationDisabled: RequestHandler = (_req, _res, next) => {
    createAscent.ensureEnabled();
    next();
  };

  router.post('/', refuseWhenCreationDisabled, receiveGpxFile(), async (req, res) => {
    const { name, surface, gpx } = uploadSchema.parse({ ...req.body, gpx: req.file });
    const path = readGpxPath(gpx.buffer.toString('utf8'));

    const ascent = await createAscent.execute({ name, surface, path });

    res.status(201).json(toAscentResponse(ascent));
  });

  // Declared before `/:id`, which would otherwise capture it.
  router.get('/nearby', async (req, res) => {
    const { latitude, longitude, radius, limit, activity, category } = nearbyQuerySchema.parse(
      normaliseQuery(req.query, {
        numbers: ['latitude', 'longitude', 'radius', 'limit'],
        repeatable: ['activity', 'category'],
      }),
    );

    const results = await findAscentsNearby.execute({
      position: { latitude, longitude },
      radius,
      limit,
      activities: activity,
      categories: category,
    });

    res.json(toNearbyAscentsResponse(results));
  });

  router.get('/:id', async (req, res) => {
    const { id } = ascentIdParamsSchema.parse(req.params);

    res.json(toAscentResponse(await getAscent.execute(id)));
  });

  return router;
}

interface QueryShape {
  /** Parameters holding a number; unparseable values become NaN and fail validation. */
  readonly numbers: readonly string[];
  /** Parameters that may be repeated (`?activity=a&activity=b`). */
  readonly repeatable: readonly string[];
}

/**
 * Turns the raw query strings into the shape the schema expects: empty values are
 * dropped (`?latitude=` means missing, not 0), numbers are parsed and repeatable
 * parameters become arrays. Keeping this out of the schema lets OpenAPI describe the
 * parameters exactly (required numbers with bounds, arrays of enums).
 */
function normaliseQuery(
  query: Record<string, unknown>,
  { numbers, repeatable }: QueryShape,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== '')
      .map(([name, value]) => {
        if (numbers.includes(name)) {
          return [name, typeof value === 'string' ? Number(value) : value];
        }
        return [name, repeatable.includes(name) ? [value].flat() : value];
      }),
  );
}

/** Reads the `gpx` file of a multipart request into memory, enforcing the size limit. */
function receiveGpxFile(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: MAXIMUM_GPX_FILE_SIZE },
  }).single('gpx');

  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          error.code === 'LIMIT_FILE_SIZE'
            ? new GpxTooLargeError(`The file exceeds ${String(MAXIMUM_GPX_FILE_SIZE)} bytes.`)
            : new RequestValidationError(`Invalid upload: ${error.message}.`),
        );
        return;
      }
      next(error);
    });
  };
}
