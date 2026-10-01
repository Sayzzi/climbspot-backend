import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import type { CreateAscent } from '../application/create-ascent.ts';
import type { GetAscent } from '../application/get-ascent.ts';
import { toAscentResponse } from './ascent.mapper.ts';
import { ascentIdParamsSchema, createAscentFieldsSchema } from './ascent.schemas.ts';
import { readGpxPath } from './gpx.ts';

export interface AscentsRouterDependencies {
  readonly createAscent: CreateAscent;
  readonly getAscent: GetAscent;
}

const uploadSchema = createAscentFieldsSchema.extend({
  gpx: z.custom<Express.Multer.File>((file) => file !== undefined, 'A GPX file is required.'),
});

export function createAscentsRouter({
  createAscent,
  getAscent,
}: AscentsRouterDependencies): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1 } });

  router.post('/', upload.single('gpx'), async (req, res) => {
    const { name, surface, gpx } = uploadSchema.parse({ ...req.body, gpx: req.file });
    const path = readGpxPath(gpx.buffer.toString('utf8'));

    const ascent = await createAscent.execute({ name, surface, path });

    res.status(201).json(toAscentResponse(ascent));
  });

  router.get('/:id', async (req, res) => {
    const { id } = ascentIdParamsSchema.parse(req.params);

    res.json(toAscentResponse(await getAscent.execute(id)));
  });

  return router;
}
